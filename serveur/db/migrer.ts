// Migrations à empreinte, sous verrou (modèle : app-deroules, db/migrate.mjs).
//
// Chaque fichier de db/migrations est appliqué une fois, dans sa transaction, et
// son empreinte SHA-256 est inscrite au registre. Un fichier déjà appliqué dont
// l'empreinte a changé, un fichier en base absent du dépôt, ou un historique
// non linéaire arrêtent tout : une migration ne se réécrit pas.
//
// Exécuté avec le rôle propriétaire (DATABASE_MIGRATION_URL), jamais avec le
// rôle applicatif, qui n'a aucun droit sur le registre.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export interface Migration {
  fichier: string;
  sql: string;
  empreinte: string;
}

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function chargerMigrations(dossier = DOSSIER): Promise<Migration[]> {
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".sql")).sort();
  return Promise.all(
    fichiers.map(async (fichier) => {
      const sql = await readFile(join(dossier, fichier), "utf8");
      return { fichier, sql, empreinte: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

/** Ce qui reste à appliquer ; lève si l'historique en base diverge du dépôt. */
export function planMigrations(
  migrations: Migration[],
  appliquees: { fichier: string; empreinte: string }[],
): Migration[] {
  const connues = new Map(migrations.map((m) => [m.fichier, m]));
  appliquees.forEach((ligne, rang) => {
    const m = connues.get(ligne.fichier);
    if (!m) throw new Error(`Divergence : ${ligne.fichier} est en base mais absent du dépôt.`);
    if (m.empreinte !== ligne.empreinte)
      throw new Error(`Divergence : l'empreinte de ${ligne.fichier} a changé.`);
    if (migrations[rang]?.fichier !== ligne.fichier)
      throw new Error("Divergence : historique des migrations non linéaire.");
  });
  return migrations.slice(appliquees.length);
}

export async function migrer(
  url: string,
  journal: (message: string) => void = () => {},
): Promise<string[]> {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 120_000,
    application_name: "composer-migrations",
  });
  await client.connect();
  let verrou = false;
  const appliquees: string[] = [];
  try {
    await client.query("select pg_advisory_lock(hashtext('composer-schema-migrations'))");
    verrou = true;
    await client.query(`create table if not exists public.schema_migrations (
      fichier    text primary key,
      empreinte  char(64) not null,
      applique_le timestamptz not null default now()
    )`);
    await client.query("revoke all on public.schema_migrations from public");
    const { rows } = await client.query<{ fichier: string; empreinte: string }>(
      "select fichier, empreinte from public.schema_migrations order by fichier",
    );
    for (const m of planMigrations(await chargerMigrations(), rows)) {
      await client.query("begin");
      try {
        await client.query(m.sql);
        await client.query(
          "insert into public.schema_migrations (fichier, empreinte) values ($1, $2)",
          [m.fichier, m.empreinte],
        );
        await client.query("commit");
      } catch (erreur) {
        await client.query("rollback");
        throw erreur;
      }
      appliquees.push(m.fichier);
      journal(`migration appliquée : ${m.fichier} (${m.empreinte})`);
    }
    return appliquees;
  } finally {
    if (verrou)
      await client
        .query("select pg_advisory_unlock(hashtext('composer-schema-migrations'))")
        .catch(() => undefined);
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL est requis.");
  const faites = await migrer(url, (m) => console.log(m));
  console.log(faites.length ? `${faites.length} migration(s) appliquée(s).` : "Base à jour.");
}
