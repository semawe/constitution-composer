// Le processus : un serveur node:http qui traduit chaque requête en Request
// standard et rend la Response de l'application. Écoute sur la boucle locale,
// derrière nginx (même origine que le site, sous /api).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { creerApplication, type Gestionnaire } from "./application.ts";
import { creerPool } from "./base.ts";
import { configurationDepuisEnv } from "./configuration.ts";
import { clesGoogle } from "./google.ts";
import { ENTETES_JSON } from "./http.ts";

/** Au-delà, 413 avant toute lecture applicative : une charge vaut 1,5 Mo au plus. */
export const LIMITE_CORPS = 2 * 1024 * 1024;

function refuser(res: ServerResponse, statut: number, code: string): void {
  res.writeHead(statut, ENTETES_JSON);
  res.end(JSON.stringify({ erreur: code }));
}

/**
 * Adresse du client : X-Real-IP, posée par nginx et que le client ne choisit
 * pas, sinon l'adresse de la socket (développement sans mandataire).
 */
function ipDuClient(req: IncomingMessage): string | null {
  const reelle = req.headers["x-real-ip"];
  if (typeof reelle === "string" && reelle.trim()) return reelle.trim().slice(0, 64);
  return req.socket.remoteAddress ?? null;
}

export function ecouteurHttp(gerer: Gestionnaire, origine: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const morceaux: Buffer[] = [];
      let taille = 0;
      for await (const morceau of req) {
        taille += (morceau as Buffer).length;
        if (taille > LIMITE_CORPS) {
          refuser(res, 413, "TROP_GROS");
          req.destroy();
          return;
        }
        morceaux.push(morceau as Buffer);
      }
      const entetes = new Headers();
      for (const [nom, valeur] of Object.entries(req.headers)) {
        if (valeur === undefined) continue;
        entetes.set(nom, Array.isArray(valeur) ? valeur.join(", ") : valeur);
      }
      const methode = req.method ?? "GET";
      const requete = new Request(new URL(req.url ?? "/", origine), {
        method: methode,
        headers: entetes,
        body: methode === "GET" || methode === "HEAD" ? undefined : Buffer.concat(morceaux),
      });
      const reponse = await gerer(requete, { ip: ipDuClient(req) });
      const sortants: Record<string, string | string[]> = {};
      reponse.headers.forEach((valeur, nom) => {
        if (nom !== "set-cookie") sortants[nom] = valeur;
      });
      const cookies = reponse.headers.getSetCookie();
      if (cookies.length) sortants["set-cookie"] = cookies;
      res.writeHead(reponse.status, sortants);
      res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch (e) {
      console.error(JSON.stringify({ evenement: "http.erreur", message: (e as Error).message }));
      if (!res.headersSent) refuser(res, 500, "INTERNE");
      else res.end();
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = configurationDepuisEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis.");
  const pool = creerPool(url);
  const gerer = creerApplication({ pool, config, fetcher: fetch, clesGoogle: clesGoogle() });
  const serveur = createServer(ecouteurHttp(gerer, config.origine));
  serveur.requestTimeout = 30_000;
  serveur.headersTimeout = 10_000;
  const port = Number(process.env.PORT ?? 3100);
  const hote = process.env.HOST ?? "127.0.0.1";
  serveur.listen(port, hote, () =>
    console.log(JSON.stringify({ evenement: "demarrage", hote, port })),
  );
  const arreter = () => {
    serveur.close(() => void pool.end().then(() => process.exit(0)));
  };
  process.on("SIGTERM", arreter);
  process.on("SIGINT", arreter);
}
