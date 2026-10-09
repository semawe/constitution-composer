// Accès à la base. Chaque requête liée à un compte ouvre une transaction qui
// déclare ce compte (`composer.compte`) : la sécurité par ligne s'applique sur
// lui, et sur lui seul, jusqu'à la fin de la transaction.

import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

export type Pool = pg.Pool;
export type Client = pg.PoolClient;

export function creerPool(url: string, nom = "composer-serveur"): Pool {
  return new pg.Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    application_name: nom,
  });
}

/**
 * Exécute `travail` dans une transaction. Si `compte` est donné, il est déclaré
 * avant toute requête ; sinon la transaction ne voit aucun document.
 */
export async function enTransaction<T>(
  pool: Pool,
  compte: string | null,
  travail: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (compte) await declarerCompte(client, compte);
    const resultat = await travail(client);
    await client.query("commit");
    return resultat;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function declarerCompte(client: Client, compte: string): Promise<void> {
  await client.query("select set_config('composer.compte', $1, true)", [compte]);
}

/** Jeton opaque de 256 bits. */
export function jetonAleatoire(): string {
  return randomBytes(32).toString("base64url");
}

export function empreinte(valeur: string): string {
  return createHash("sha256").update(valeur).digest("hex");
}

/** Code SQLSTATE d'une erreur PostgreSQL, ou null. */
export function codeSql(e: unknown): string | null {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" ? code : null;
}

export function contrainteSql(e: unknown): string | null {
  const c = (e as { constraint?: unknown })?.constraint;
  return typeof c === "string" ? c : null;
}
