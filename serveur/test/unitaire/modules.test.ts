// Tests sans base : les fonctions pures du service.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { planMigrations, chargerMigrations } from "../../db/migrer.ts";
import { configurationDepuisEnv, lireSecrets } from "../../src/configuration.ts";
import { creerEtat, lireEtat, signerEtat } from "../../src/google.ts";
import { cheminLocal, cookie, gardeOrigine, lireCookie, nomCookie } from "../../src/http.ts";
import { cleDeBoite, envoyerLien, normaliserAdresse } from "../../src/lien.ts";
import { LOGO_MAX_CARACTERES, logoAdmis } from "../../src/logo.ts";
import { chargerManifeste, referenceConnue } from "../../src/releases.ts";
import { configurationSlack, messageInscription, texteSlack } from "../../src/slack.ts";

const MANIFESTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "data", "releases", "manifest.json");

test("adresses : normalisation et clé de boîte", () => {
  assert.equal(normaliserAdresse("  Ada@Exemple.TEST "), "ada@exemple.test");
  for (const mauvaise of ["", "ada", "a@b", "a b@c.d", "a@b.c,d@e.f", 42, null])
    assert.equal(normaliserAdresse(mauvaise), null, String(mauvaise));
  assert.equal(cleDeBoite("j.e.a.n+composer@googlemail.com"), "jean@gmail.com");
  assert.equal(cleDeBoite("jean.dupont+x@exemple.fr"), "jean.dupont@exemple.fr");
});

test("Slack : texte inerte, borné à 120 caractères, webhook validé", () => {
  assert.equal(texteSlack("<!channel> & <@U1>\nfin"), "&lt;!channel&gt; &amp; &lt;@U1&gt; fin");
  assert.equal(texteSlack("x".repeat(500)).length, 120);
  // Échappé après troncature, comme private.slack_text (0006).
  assert.equal(texteSlack(`${"x".repeat(119)}<`), `${"x".repeat(119)}&lt;`);
  assert.equal(
    messageInscription(null, "ada@exemple.test"),
    ":new: *ada* (ada@exemple.test) a créé son compte sur Constitution Composer.",
  );
  assert.equal(configurationSlack(""), null);
  assert.ok(configurationSlack("https://hooks.slack.com/services/T1/B2/abc"));
  for (const mauvais of [
    "http://hooks.slack.com/services/T1/B2/abc",
    "https://evil.example/services/T1/B2/abc",
    "https://hooks.slack.com/services/T1/B2/abc?x=1",
  ])
    assert.throws(() => configurationSlack(mauvais), mauvais);
});

test("référence de contenu : règle de canonicalRef, empreinte exigée", () => {
  const m = chargerManifeste(MANIFESTE);
  const r = m.releases.at(-1)!;
  const ref = { locale: "fr", release: r.id, sha256: r.sha256["constitution.fr.json"], kind: "constitution" };
  assert.ok(referenceConnue(m, ref));
  assert.ok(referenceConnue(m, { ...ref, kind: undefined }));
  assert.ok(referenceConnue(m, { ...ref, kind: "principes", sha256: r.sha256["principes.fr.json"] }, "principes"));
  assert.ok(!referenceConnue(m, { ...ref, sha256: undefined }));
  assert.ok(!referenceConnue(m, { ...ref, release: "inconnue" }));
  assert.ok(!referenceConnue(m, { ...ref, locale: "es" }));
  assert.ok(!referenceConnue(m, { ...ref, kind: "principes" }));
  assert.ok(!referenceConnue(m, null));
});

test("HTTP : chemins locaux, garde d'origine, cookies d'hôte", () => {
  assert.equal(cheminLocal("/composer?vue=principes"), "/composer?vue=principes");
  for (const mauvais of ["//evil.example", "https://evil.example", "/\\evil", "composer", "/a\nb", 3])
    assert.equal(cheminLocal(mauvais), null, String(mauvais));
  const o = "https://constitution-composer.com";
  const req = (origin?: string) =>
    new Request(`${o}/api/x`, { method: "POST", headers: origin ? { origin } : {} });
  assert.equal(gardeOrigine(req(o), o), null);
  assert.equal(gardeOrigine(req(), o)?.status, 403);
  assert.equal(gardeOrigine(req("https://constitution-composer.com.evil.example"), o)?.status, 403);
  assert.equal(gardeOrigine(req("null"), o)?.status, 403);
  assert.equal(nomCookie("cc_session", o), "__Host-cc_session");
  assert.equal(nomCookie("cc_session", "http://localhost:3000"), "cc_session");
  assert.equal(
    cookie("__Host-cc_session", "v", 60, o),
    "__Host-cc_session=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure",
  );
  const avecCookies = new Request(o, { headers: { cookie: "a=1; __Host-cc_session=abc; b=2" } });
  assert.equal(lireCookie(avecCookies, "__Host-cc_session"), "abc");
  assert.equal(lireCookie(avecCookies, "c"), null);
});

test("état Google : signé, lié au state, refusé falsifié ou sous une autre clé", async () => {
  const secrets = [new Uint8Array(randomBytes(32))];
  const etat = creerEtat("/composer");
  const jeton = await signerEtat(etat, secrets);
  assert.deepEqual(await lireEtat(jeton, etat.state, secrets), etat);
  assert.equal(await lireEtat(jeton, `${etat.state}x`, secrets), null);
  assert.equal(await lireEtat(jeton, etat.state, [new Uint8Array(randomBytes(32))]), null);
  // Rotation : l'ancienne clé vérifie encore.
  assert.deepEqual(await lireEtat(jeton, etat.state, [new Uint8Array(randomBytes(32)), secrets[0]]), etat);
  const [h, , s] = jeton.split(".");
  const forge = Buffer.from(JSON.stringify({ ...etat, retour: "//evil" })).toString("base64url");
  assert.equal(await lireEtat(`${h}.${forge}.${s}`, etat.state, secrets), null);
});

test("configuration : secrets d'au moins 32 octets, HTTPS hors local, Google complet", () => {
  assert.throws(() => lireSecrets(""));
  assert.throws(() => lireSecrets(randomBytes(16).toString("base64url")));
  assert.equal(lireSecrets(`${randomBytes(32).toString("base64url")},${randomBytes(48).toString("base64url")}`).length, 2);
  const base = { APP_ORIGIN: "https://constitution-composer.com", COMPOSER_SECRETS: randomBytes(32).toString("base64url"), RELEASES_MANIFEST: MANIFESTE };
  const c = configurationDepuisEnv(base);
  assert.equal(c.origine, "https://constitution-composer.com");
  assert.equal(c.google, null);
  assert.equal(c.brevo, null);
  assert.throws(() => configurationDepuisEnv({ ...base, APP_ORIGIN: "http://constitution-composer.com" }));
  assert.throws(() => configurationDepuisEnv({ ...base, GOOGLE_CLIENT_ID: "seul" }));
  assert.throws(() => configurationDepuisEnv({ ...base, BREVO_API_KEY: "cle" }));
});

test("migrations : un fichier appliqué ne se réécrit pas, l'historique reste linéaire", async () => {
  const migrations = await chargerMigrations();
  assert.ok(migrations.length >= 1);
  const [m] = migrations;
  assert.deepEqual(planMigrations(migrations, []), migrations);
  assert.deepEqual(planMigrations(migrations, [{ fichier: m.fichier, empreinte: m.empreinte }]), migrations.slice(1));
  assert.throws(() => planMigrations(migrations, [{ fichier: m.fichier, empreinte: "0".repeat(64) }]), /empreinte/);
  assert.throws(() => planMigrations(migrations, [{ fichier: "9999_inconnue.sql", empreinte: m.empreinte }]), /absent/);
});

test("logo d'une version : data: URL d'image raster, bornée, jamais de SVG ni d'URL externe", () => {
  for (const admis of [undefined, null, "", "data:image/png;base64,iVBORw0KGgo=", "data:image/jpeg;base64,/9j/4AAQ", "data:image/webp;base64,UklGRg==", "data:image/gif;base64,R0lGODlh"])
    assert.equal(logoAdmis(admis), true, String(admis));
  const refuses: unknown[] = [
    "https://exemple.test/logo.png",
    "//exemple.test/logo.png",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/png,iVBORw0KGgo",
    "data:image/png;base64,iVBOR w0KGgo",
    "data:image/png;base64,iVBORw0KGgo=\n",
    "data:image/png;base64,=abc",
    "DATA:IMAGE/PNG;BASE64,iVBORw0KGgo",
    `data:image/png;base64,${"A".repeat(LOGO_MAX_CARACTERES)}`,
    42,
    { src: "data:image/png;base64,AAAA" },
  ];
  for (const refuse of refuses) assert.equal(logoAdmis(refuse), false, String(refuse).slice(0, 60));
  const auPlafond = `data:image/png;base64,${"A".repeat(LOGO_MAX_CARACTERES - "data:image/png;base64,".length)}`;
  assert.equal(auPlafond.length, LOGO_MAX_CARACTERES);
  assert.equal(logoAdmis(auPlafond), true);
});

test("courriel de connexion : suivi des ouvertures et des clics anonymisé pour le destinataire", async () => {
  const envois: Record<string, unknown>[] = [];
  const fetcher = async (_url: string, init?: RequestInit) => {
    envois.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 201 });
  };
  const ok = await envoyerLien(
    { cle: "cle", expediteur: { email: "connexion@composer.test", name: "Composer" } },
    "ada@exemple.test",
    "https://composer.test/connexion/confirmer?jeton=abc",
    "fr",
    fetcher,
  );
  assert.equal(ok, true);
  assert.deepEqual(envois[0].to, [{ email: "ada@exemple.test", contactPixelTrackingConsent: false }]);
});
