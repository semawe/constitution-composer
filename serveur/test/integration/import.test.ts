// Preuve 9 : l'import rejoué deux fois donne le même état. Et : une empreinte
// divergente annule tout ; les comptes repris se reconnectent sur leur compte,
// retrouvent leurs documents, et ne sont pas réannoncés à Slack.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { importerFichier, lireExport, FORMAT_EXPORT, type Export } from "../../db/importer.ts";
import { chargeValide, connecter, Navigateur, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;
let dossier: string;

before(async () => {
  banc = await ouvrirBanc();
  dossier = await mkdtemp(join(tmpdir(), "composer-import-"));
  await preparerExport();
});

after(() => banc.fin());

const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

// Les charges voyagent sous la forme texte que PostgreSQL rend (`payload::text` :
// clés dans l'ordre jsonb, nombres tels qu'écrits, 1.10 reste 1.10). Le banc
// la demande à PostgreSQL, comme l'export la demande à Supabase.
let texteDeclaration = '{"valeurs": "Raison d\'être", "montant": 1.10, "principes": [1, 2]}';
let texteVersion = JSON.stringify({ ...chargeValide("Constitution reprise"), active: ["a"] });

const A = randomUUID();
const B = randomUUID();
const exportSupabase: Export = {
  format: FORMAT_EXPORT,
  comptes: [
    { id: A, email: "Melanie@Exemple.test", cree_le: "2026-07-10T09:00:00Z", nom: "Mélanie V.", prenom: "Mélanie", organisation: "Coopérative" },
    { id: B, email: "gilles@exemple.test", cree_le: "2026-07-22T10:00:00Z", nom: null, prenom: null, organisation: null },
  ],
  identites_google: [{ compte_id: A, issuer: "https://accounts.google.com", sujet: "1098765" }],
  declarations: [
    { compte_id: A, payload: texteDeclaration, revision: 42, modifie_le: "2026-09-01T08:00:00Z", sha256: "" },
  ],
  versions: [
    { id: randomUUID(), compte_id: A, nom: "Version reprise", payload: texteVersion, cree_le: "2026-07-11T08:00:00Z", modifie_le: "2026-07-12T08:00:00Z", sha256: "" },
  ],
  propositions: [
    { id: randomUUID(), compte_id: B, nom: "App reprise", nature: "app", point_integration: null, description: "d", justification: null, statut: "approved", note_revue: "vue", cree_le: "2026-07-23T08:00:00Z", revue_le: "2026-07-24T08:00:00Z" },
  ],
  annonces_slack: [{ compte_id: A, organisation_le: "2026-07-10T09:05:00Z" }],
};
async function preparerExport() {
  const canonique = async (t: string) =>
    (await banc.admin.query<{ t: string }>("select $1::jsonb::text as t", [t])).rows[0].t;
  texteDeclaration = await canonique(texteDeclaration);
  texteVersion = await canonique(texteVersion);
  assert.match(texteDeclaration, /"montant": 1\.10/);
  exportSupabase.declarations[0].payload = texteDeclaration;
  exportSupabase.versions[0].payload = texteVersion;
  for (const c of [...exportSupabase.declarations, ...exportSupabase.versions]) c.sha256 = sha(c.payload);
}

async function ecrire(donnees: unknown): Promise<string> {
  const chemin = join(dossier, `${randomUUID()}.json`);
  await writeFile(chemin, JSON.stringify(donnees));
  return chemin;
}

async function etat(): Promise<unknown> {
  const tables = ["comptes", "profils", "identites_google", "declarations", "versions", "propositions", "annonces_slack"];
  const r: Record<string, unknown> = {};
  for (const t of tables)
    r[t] = (await banc.admin.query(`select to_jsonb(x) as l from composer.${t} x order by 1`)).rows
      .map((l) => JSON.stringify(l.l))
      .sort();
  return r;
}

test("l'import rejoué deux fois donne le même état", async () => {
  const chemin = await ecrire(exportSupabase);
  const bilan = await importerFichier(banc.ownerUrl, chemin);
  assert.deepEqual(bilan, { comptes: 2, identites_google: 1, declarations: 1, versions: 1, propositions: 1 });
  const premier = await etat();
  await importerFichier(banc.ownerUrl, chemin);
  assert.deepEqual(await etat(), premier);

  const decl = await banc.admin.query("select payload::text as t, revision from composer.declarations where compte_id = $1", [A]);
  assert.equal(decl.rows[0].t, texteDeclaration, "le texte jsonb, nombres compris, est conservé");
  assert.equal(decl.rows[0].revision, "42");
  const email = await banc.admin.query("select email from composer.comptes where id = $1", [A]);
  assert.equal(email.rows[0].email, "melanie@exemple.test");
});

test("une empreinte divergente annule tout l'import", async () => {
  const avant = await etat();
  const altere = structuredClone(exportSupabase);
  altere.comptes.push({ id: randomUUID(), email: "nouveau@exemple.test", cree_le: "2026-07-30T00:00:00Z" });
  altere.versions[0].sha256 = sha("autre chose");
  assert.throws(() => lireExport(altere), /Empreinte/);
  await assert.rejects(importerFichier(banc.ownerUrl, await ecrire(altere)), /Empreinte/);
  assert.deepEqual(await etat(), avant);

  // Empreinte conforme au texte reçu, mais la base garde autre chose que ce que
  // Supabase avait (texte qui n'est pas la forme jsonb) : la divergence est vue
  // après écriture, et la transaction entière est annulée.
  const reecrit = structuredClone(exportSupabase);
  reecrit.comptes.push({ id: randomUUID(), email: "autre@exemple.test", cree_le: "2026-07-30T00:00:00Z" });
  reecrit.declarations[0].payload = '{"valeurs":"x","montant":1.10}';
  reecrit.declarations[0].sha256 = sha(reecrit.declarations[0].payload);
  assert.doesNotThrow(() => lireExport(reecrit));
  await assert.rejects(importerFichier(banc.ownerUrl, await ecrire(reecrit)), /empreinte divergente après import/);
  assert.deepEqual(await etat(), avant);
});

test("un compte repris se reconnecte sur son compte, sans réannonce Slack", async () => {
  banc.slack.length = 0;
  const nav = new Navigateur(banc);
  const compte = await connecter(nav, "melanie@exemple.test");
  assert.equal(compte.id, A);
  const lue = await (await nav.get("/api/declaration")).json();
  assert.equal(lue.declaration.revision, 42);
  // La prochaine écriture de la file part de la révision reprise.
  const ecrite = await (await nav.post("/api/declaration", { compte: A, payload: { suite: true }, revision: 43 })).json();
  assert.equal(ecrite.ecrite, true);
  const versions = await (await nav.get("/api/versions")).json();
  assert.equal(versions.versions[0].name, "Version reprise");
  // L'organisation déjà annoncée ne l'est pas une seconde fois.
  await nav.post("/api/profil", { compte: A, organisation: "Coopérative renommée" });
  assert.deepEqual(banc.slack, []);
});
