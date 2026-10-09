// Reprise des comptes depuis Supabase : import idempotent, en une transaction.
//
//   DATABASE_MIGRATION_URL=… node db/importer.ts export.json
//
// L'export est produit par db/export-supabase.sql (lecture seule, éditeur SQL de
// Supabase). Chaque charge y voyage sous sa forme texte jsonb, avec son
// empreinte SHA-256 calculée côté Supabase. L'import vérifie l'empreinte du
// texte reçu, l'écrit, puis recalcule l'empreinte de ce que la base a gardé : la
// moindre différence annule toute la transaction.
//
// Rejoué, l'import donne le même état : chaque ligne est réécrite à
// l'identique (identifiants, révisions et dates d'origine conservés), jamais
// dupliquée. Exécuté avec le rôle propriétaire, que la sécurité par ligne ne
// concerne pas.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

export const FORMAT_EXPORT = "composer-export.v1";

interface CompteExporte {
  id: string;
  email: string;
  cree_le: string;
  nom?: string | null;
  prenom?: string | null;
  organisation?: string | null;
}
interface Charge {
  payload: string;
  sha256: string;
}
interface DeclarationExportee extends Charge {
  compte_id: string;
  revision: number;
  modifie_le: string;
}
interface VersionExportee extends Charge {
  id: string;
  compte_id: string;
  nom: string;
  cree_le: string;
  modifie_le: string;
}
interface PropositionExportee {
  id: string;
  compte_id: string;
  nom: string;
  nature: string;
  point_integration: string | null;
  description: string;
  justification: string | null;
  statut: string;
  note_revue: string | null;
  cree_le: string;
  revue_le: string | null;
}
export interface Export {
  format: typeof FORMAT_EXPORT;
  comptes: CompteExporte[];
  identites_google: { compte_id: string; issuer: string; sujet: string }[];
  declarations: DeclarationExportee[];
  versions: VersionExportee[];
  propositions: PropositionExportee[];
  annonces_slack: { compte_id: string; organisation_le: string | null }[];
}

export interface Bilan {
  comptes: number;
  identites_google: number;
  declarations: number;
  versions: number;
  propositions: number;
}

function sha256(texte: string): string {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

export function lireExport(brut: unknown): Export {
  const e = brut as Partial<Export>;
  if (!e || e.format !== FORMAT_EXPORT) throw new Error(`Export attendu au format ${FORMAT_EXPORT}.`);
  for (const cle of [
    "comptes",
    "identites_google",
    "declarations",
    "versions",
    "propositions",
    "annonces_slack",
  ] as const)
    if (!Array.isArray(e[cle])) throw new Error(`Export incomplet : « ${cle} » manque.`);
  for (const charge of [...e.declarations!, ...e.versions!]) {
    if (typeof charge.payload !== "string" || typeof charge.sha256 !== "string")
      throw new Error("Chaque charge voyage en texte, avec son empreinte.");
    if (sha256(charge.payload) !== charge.sha256)
      throw new Error("Empreinte d'une charge différente de celle de l'export.");
  }
  return e as Export;
}

/** Importe dans une transaction ouverte par l'appelant ; lève sur toute divergence. */
export async function importer(client: pg.ClientBase, donnees: Export): Promise<Bilan> {
  for (const c of donnees.comptes) {
    await client.query(
      `insert into composer.comptes (id, email, cree_le) values ($1, lower($2), $3)
       on conflict (id) do update set email = excluded.email, cree_le = excluded.cree_le`,
      [c.id, c.email, c.cree_le],
    );
    await client.query(
      `insert into composer.profils (compte_id, nom, prenom, organisation, modifie_le)
       values ($1, $2, $3, $4, $5)
       on conflict (compte_id) do update
          set nom = excluded.nom, prenom = excluded.prenom,
              organisation = excluded.organisation, modifie_le = excluded.modifie_le`,
      [c.id, c.nom || null, c.prenom || null, c.organisation || null, c.cree_le],
    );
  }

  for (const i of donnees.identites_google)
    await client.query(
      `insert into composer.identites_google (issuer, sujet, compte_id) values ($1, $2, $3)
       on conflict (issuer, sujet) do update set compte_id = excluded.compte_id`,
      [i.issuer, i.sujet, i.compte_id],
    );

  for (const d of donnees.declarations)
    await client.query(
      `insert into composer.declarations (compte_id, payload, revision, modifie_le)
       values ($1, $2::jsonb, $3, $4)
       on conflict (compte_id) do update
          set payload = excluded.payload, revision = excluded.revision,
              modifie_le = excluded.modifie_le`,
      [d.compte_id, d.payload, d.revision, d.modifie_le],
    );

  for (const v of donnees.versions)
    await client.query(
      `insert into composer.versions (id, compte_id, nom, payload, cree_le, modifie_le)
       values ($1, $2, $3, $4::jsonb, $5, $6)
       on conflict (id) do update
          set compte_id = excluded.compte_id, nom = excluded.nom, payload = excluded.payload,
              cree_le = excluded.cree_le, modifie_le = excluded.modifie_le`,
      [v.id, v.compte_id, v.nom, v.payload, v.cree_le, v.modifie_le],
    );

  for (const p of donnees.propositions)
    await client.query(
      `insert into composer.propositions
         (id, compte_id, nom, nature, point_integration, description, justification,
          statut, note_revue, cree_le, revue_le)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update
          set compte_id = excluded.compte_id, nom = excluded.nom, nature = excluded.nature,
              point_integration = excluded.point_integration,
              description = excluded.description, justification = excluded.justification,
              statut = excluded.statut, note_revue = excluded.note_revue,
              cree_le = excluded.cree_le, revue_le = excluded.revue_le`,
      [
        p.id,
        p.compte_id,
        p.nom,
        p.nature,
        p.point_integration,
        p.description,
        p.justification,
        p.statut,
        p.note_revue,
        p.cree_le,
        p.revue_le,
      ],
    );

  // Tout compte repris a déjà été annoncé à sa création ; son organisation
  // l'a été si Supabase le dit. Aucun ne sera réannoncé.
  const organisation = new Map(donnees.annonces_slack.map((a) => [a.compte_id, a.organisation_le]));
  for (const c of donnees.comptes)
    await client.query(
      `insert into composer.annonces_slack (compte_id, inscription_le, organisation_le)
       values ($1, $2, $3)
       on conflict (compte_id) do update
          set inscription_le = excluded.inscription_le, organisation_le = excluded.organisation_le`,
      [c.id, c.cree_le, organisation.get(c.id) ?? null],
    );

  // Contrôle : ce que la base a gardé a la même empreinte que ce que Supabase a exporté.
  const empreintes = async (table: string, cle: string) =>
    new Map(
      (
        await client.query<{ cle: string; sha: string }>(
          `select ${cle}::text as cle, encode(sha256(convert_to(payload::text, 'UTF8')), 'hex') as sha
             from composer.${table}`,
        )
      ).rows.map((r) => [r.cle, r.sha]),
    );
  const declarations = await empreintes("declarations", "compte_id");
  for (const d of donnees.declarations)
    if (declarations.get(d.compte_id) !== d.sha256)
      throw new Error(`Déclaration ${d.compte_id} : empreinte divergente après import.`);
  const versions = await empreintes("versions", "id");
  for (const v of donnees.versions)
    if (versions.get(v.id) !== v.sha256)
      throw new Error(`Version ${v.id} : empreinte divergente après import.`);

  return {
    comptes: donnees.comptes.length,
    identites_google: donnees.identites_google.length,
    declarations: donnees.declarations.length,
    versions: donnees.versions.length,
    propositions: donnees.propositions.length,
  };
}

export async function importerFichier(url: string, chemin: string): Promise<Bilan> {
  const donnees = lireExport(JSON.parse(await readFile(chemin, "utf8")));
  const client = new pg.Client({ connectionString: url, application_name: "composer-import" });
  await client.connect();
  try {
    await client.query("begin");
    const bilan = await importer(client, donnees);
    await client.query("commit");
    return bilan;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_MIGRATION_URL;
  const chemin = process.argv[2];
  if (!url || !chemin) throw new Error("Usage : DATABASE_MIGRATION_URL=… node db/importer.ts export.json");
  console.log(JSON.stringify(await importerFichier(url, chemin)));
}
