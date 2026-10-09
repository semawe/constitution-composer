// Configuration du service, lue dans l'environnement. Aucun secret dans le
// dépôt : les noms des variables sont dans env.example.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chargerManifeste, type Manifeste } from "./releases.ts";
import { configurationSlack, type ConfigurationSlack } from "./slack.ts";

export interface ConfigurationGoogle {
  clientId: string;
  clientSecret: string;
}

export interface ConfigurationBrevo {
  cle: string;
  expediteur: { email: string; name: string };
}

export interface Configuration {
  /** Origine publique du site et du service : https://constitution-composer.com. */
  origine: string;
  /** Clés HMAC du cookie d'état Google ; la première signe, toutes vérifient. */
  secrets: Uint8Array[];
  google: ConfigurationGoogle | null;
  brevo: ConfigurationBrevo | null;
  slack: ConfigurationSlack | null;
  manifeste: Manifeste;
}

type Env = Readonly<Record<string, string | undefined>>;

const MANIFESTE_PAR_DEFAUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "data",
  "releases",
  "manifest.json",
);

export function origineValide(brute: string): string {
  const url = new URL(brute);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("APP_ORIGIN doit être en HTTPS hors développement local.");
  return url.origin;
}

/** COMPOSER_SECRETS : une ou plusieurs clés base64url d'au moins 32 octets, séparées par des virgules. */
export function lireSecrets(brut: string | undefined): Uint8Array[] {
  const cles = (brut ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new Uint8Array(Buffer.from(s, "base64url")));
  if (!cles.length || cles.some((c) => c.length < 32))
    throw new Error("COMPOSER_SECRETS doit porter au moins une clé de 32 octets (base64url).");
  return cles;
}

export function configurationDepuisEnv(env: Env = process.env): Configuration {
  const origine = env.APP_ORIGIN?.trim();
  if (!origine) throw new Error("APP_ORIGIN est requis.");

  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (Boolean(clientId) !== Boolean(clientSecret))
    throw new Error("GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET vont ensemble.");

  const cle = env.BREVO_API_KEY?.trim() ?? "";
  const expediteur = env.EMAIL_FROM?.trim() ?? "";
  if (cle && !expediteur) throw new Error("EMAIL_FROM est requis avec BREVO_API_KEY.");

  return {
    origine: origineValide(origine),
    secrets: lireSecrets(env.COMPOSER_SECRETS),
    google: clientId ? { clientId, clientSecret } : null,
    brevo: cle
      ? {
          cle,
          expediteur: {
            email: expediteur,
            name: env.EMAIL_FROM_NAME?.trim() || "Constitution Composer",
          },
        }
      : null,
    slack: configurationSlack(env.SLACK_WEBHOOK_URL),
    manifeste: chargerManifeste(env.RELEASES_MANIFEST?.trim() || MANIFESTE_PAR_DEFAUT),
  };
}
