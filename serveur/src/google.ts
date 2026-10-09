// Connexion Google ouverte à tout compte vérifié.
//
// Modèle : app-academie, src/lib/google-oidc.ts, mode « apprenant » (PKCE,
// state, nonce, vérification du jeton d'identité par les clés publiques de
// Google, aucun `hd`). Ajustement repris d'app-deroules : le cookie d'état est
// un JWT signé (HS256, COMPOSER_SECRETS), valable dix minutes.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";
import type { ConfigurationGoogle } from "./configuration.ts";
import type { IdentiteGoogle } from "./comptes.ts";
import type { Fetcher } from "./slack.ts";

export const ISSUER_GOOGLE = "https://accounts.google.com";
const ISSUERS = [ISSUER_GOOGLE, "accounts.google.com"];
const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
export const JETON_GOOGLE = "https://oauth2.googleapis.com/token";
export const DUREE_ETAT_S = 10 * 60;
export const CHEMIN_RETOUR_GOOGLE = "/api/connexion/google/retour";

export function clesGoogle(): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
    timeoutDuration: 10_000,
  });
}

export interface EtatOidc {
  state: string;
  nonce: string;
  verifier: string;
  retour: string;
  /** Case « nouvelles du Composer » cochée au départ (tâche ERP 846). */
  infolettre: boolean;
}

export function creerEtat(retour: string, infolettre = false): EtatOidc {
  return {
    infolettre,
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"),
    retour,
  };
}

export async function signerEtat(etat: EtatOidc, secrets: Uint8Array[]): Promise<string> {
  return new SignJWT({ ...etat })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_ETAT_S}s`)
    .sign(secrets[0]);
}

/** Relit le cookie d'état ; null s'il est absent, falsifié, expiré, ou si `state` diffère. */
export async function lireEtat(
  jeton: string | null,
  stateRecu: string | null,
  secrets: Uint8Array[],
): Promise<EtatOidc | null> {
  if (!jeton || !stateRecu) return null;
  for (const cle of secrets) {
    try {
      const { payload } = await jwtVerify(jeton, cle, { algorithms: ["HS256"] });
      const { state, nonce, verifier, retour, infolettre } = payload as Record<string, unknown>;
      if (
        typeof state !== "string" ||
        typeof nonce !== "string" ||
        typeof verifier !== "string" ||
        typeof retour !== "string" ||
        !egaliteConstante(state, stateRecu)
      )
        return null;
      return { state, nonce, verifier, retour, infolettre: infolettre === true };
    } catch {
      // clé suivante (rotation)
    }
  }
  return null;
}

function egaliteConstante(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

export function urlAutorisation(
  config: ConfigurationGoogle,
  redirectUri: string,
  etat: EtatOidc,
): URL {
  const url = new URL(AUTORISATION);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: etat.state,
    nonce: etat.nonce,
    code_challenge: createHash("sha256").update(etat.verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return url;
}

export async function echangerCode(
  config: ConfigurationGoogle,
  redirectUri: string,
  code: string,
  verifier: string,
  fetcher: Fetcher,
): Promise<string> {
  const reponse = await fetcher(JETON_GOOGLE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!reponse.ok) throw new Error(`Échange OIDC refusé par Google (${reponse.status}).`);
  const corps = (await reponse.json()) as { id_token?: unknown };
  if (typeof corps.id_token !== "string") throw new Error("Réponse Google sans id_token.");
  return corps.id_token;
}

/** Signature, émetteur, audience, expiration, nonce, azp, adresse vérifiée. */
export async function verifierJeton(
  config: ConfigurationGoogle,
  jeton: string,
  nonce: string,
  cles: JWTVerifyGetKey,
): Promise<IdentiteGoogle> {
  const { payload } = await jwtVerify(jeton, cles, {
    algorithms: ["RS256"],
    issuer: ISSUERS,
    audience: config.clientId,
    requiredClaims: ["exp", "iat", "sub"],
  });
  if (typeof payload.nonce !== "string" || !egaliteConstante(payload.nonce, nonce))
    throw new Error("Nonce OIDC invalide.");
  if (payload.azp !== undefined && payload.azp !== config.clientId)
    throw new Error("Client autorisé OIDC invalide.");
  if (payload.email_verified !== true) throw new Error("Adresse Google non vérifiée.");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255)
    throw new Error("Identifiant Google absent.");
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email.length > 320) throw new Error("Adresse Google absente.");
  return {
    issuer: ISSUER_GOOGLE,
    sujet: payload.sub,
    email,
    nom: typeof payload.name === "string" ? payload.name : null,
    prenom: typeof payload.given_name === "string" ? payload.given_name : null,
  };
}
