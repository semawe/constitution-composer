// Connexion Google (doublée : clés locales, échange de code simulé) et
// notification Slack (doublée : webhook simulé).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { adresseNeuve, connecter, Navigateur, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;

before(async () => {
  banc = await ouvrirBanc();
});

after(() => banc.fin());

/** Départ chez Google, puis retour avec le jeton donné ; rend la réponse du retour. */
async function allerRetour(
  nav: Navigateur,
  claims: (nonce: string) => Record<string, unknown>,
  options: { retour?: string; state?: (s: string) => string } = {},
) {
  const depart = await nav.get(`/api/connexion/google?retour=${encodeURIComponent(options.retour ?? "/composer")}`);
  assert.equal(depart.status, 303);
  const google = new URL(depart.headers.get("location")!);
  assert.equal(google.origin, "https://accounts.google.com");
  assert.equal(google.searchParams.get("code_challenge_method"), "S256");
  assert.equal(google.searchParams.get("redirect_uri"), "https://composer.test/api/connexion/google/retour");
  assert.equal(google.searchParams.get("hd"), null, "ouvert à tout compte Google");
  const state = google.searchParams.get("state")!;
  banc.google.prochainJeton = await banc.jetonGoogle(claims(google.searchParams.get("nonce")!));
  const s = options.state ? options.state(state) : state;
  return nav.get(`/api/connexion/google/retour?code=code-test&state=${encodeURIComponent(s)}`);
}

test("Google : nouveau compte, session, une seule annonce Slack échappée", async () => {
  banc.slack.length = 0;
  const nav = new Navigateur(banc);
  const email = adresseNeuve("google");
  const r = await allerRetour(nav, (nonce) => ({
    sub: "g-1",
    email,
    nonce,
    name: "Ada <!channel> Lovelace",
    given_name: "Ada",
  }));
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/composer");
  const cookies = r.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith("__Host-cc_session="))!;
  assert.match(session, /HttpOnly/);
  assert.match(session, /Secure/);
  assert.match(session, /SameSite=Lax/);
  assert.match(session, /Max-Age=7776000/);
  const compte = (await (await nav.get("/api/session")).json()).compte;
  assert.equal(compte.email, email);
  assert.equal(compte.prenom, "Ada");
  assert.deepEqual(banc.slack, [
    `:new: *Ada &lt;!channel&gt; Lovelace* (${email}) a créé son compte sur Constitution Composer.`,
  ]);
  // Reconnexion par Google : même compte, aucune nouvelle annonce.
  const encore = await allerRetour(new Navigateur(banc), (nonce) => ({ sub: "g-1", email, nonce }));
  assert.equal(encore.status, 303);
  assert.equal(banc.slack.length, 1);
});

test("Google puis lien sur la même adresse : un seul compte ; le sujet Google prime sur l'adresse", async () => {
  const email = adresseNeuve("meme");
  const lien = await connecter(new Navigateur(banc), email);
  const nav = new Navigateur(banc);
  await allerRetour(nav, (nonce) => ({ sub: "g-meme", email: email.toUpperCase(), nonce }));
  assert.equal((await (await nav.get("/api/session")).json()).compte.id, lien.id);
  // L'adresse Google change : le compte est retrouvé par (émetteur, sujet).
  const nav2 = new Navigateur(banc);
  await allerRetour(nav2, (nonce) => ({ sub: "g-meme", email: adresseNeuve("nouvelle"), nonce }));
  assert.equal((await (await nav2.get("/api/session")).json()).compte.id, lien.id);
});

test("Google : nonce, état, adresse non vérifiée ou audience fausse sont refusés", async () => {
  const comptesAvant = (await banc.admin.query("select count(*)::int as n from composer.comptes")).rows[0].n;
  const cas: [string, (n: string) => Record<string, unknown>, { state?: (s: string) => string }?][] = [
    ["nonce", () => ({ sub: "x1", email: adresseNeuve(), nonce: "autre-nonce-autre-nonce-autre-nonce" })],
    ["adresse non vérifiée", (nonce) => ({ sub: "x2", email: adresseNeuve(), nonce, email_verified: false })],
    ["azp", (nonce) => ({ sub: "x3", email: adresseNeuve(), nonce, azp: "autre-client" })],
    ["state", (nonce) => ({ sub: "x4", email: adresseNeuve(), nonce }), { state: (s) => `${s}x` }],
  ];
  for (const [motif, claims, options] of cas) {
    const nav = new Navigateur(banc);
    const r = await allerRetour(nav, claims, { retour: "/composer", ...options });
    assert.equal(r.status, 303, motif);
    assert.equal(r.headers.get("location"), "/composer#connexion-echouee", motif);
    assert.equal((await (await nav.get("/api/session")).json()).compte, null, motif);
  }
  // Cookie d'état falsifié : refusé même avec le bon state.
  const nav = new Navigateur(banc);
  const depart = await nav.get("/api/connexion/google");
  const state = new URL(depart.headers.get("location")!).searchParams.get("state")!;
  const [nom, jwt] = [...nav.cookies].find(([n]) => n === "__Host-cc_oidc")!;
  const [entete, , signature] = jwt.split(".");
  const forge = Buffer.from(JSON.stringify({ state, nonce: "n".repeat(43), verifier: "v".repeat(64), retour: "//evil.example" })).toString("base64url");
  nav.cookies.set(nom, `${entete}.${forge}.${signature}`);
  const r = await nav.get(`/api/connexion/google/retour?code=c&state=${state}`);
  assert.equal(r.headers.get("location"), "/composer#connexion-echouee");
  const comptesApres = (await banc.admin.query("select count(*)::int as n from composer.comptes")).rows[0].n;
  assert.equal(comptesApres, comptesAvant);
});

test("Slack : organisation annoncée une seule fois ; une panne ne fait pas échouer l'inscription", async () => {
  banc.slack.length = 0;
  const nav = new Navigateur(banc);
  const email = adresseNeuve("orga");
  const compte = await connecter(nav, email);
  assert.equal(banc.slack.length, 1);
  const r = await nav.post("/api/profil", { compte: compte.id, organisation: "La Coop *gras* <https://x|clic>" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).compte.organisation, "La Coop *gras* <https://x|clic>");
  await nav.post("/api/profil", { compte: compte.id, organisation: "" });
  await nav.post("/api/profil", { compte: compte.id, organisation: "Autre" });
  assert.equal(banc.slack.length, 2);
  assert.equal(
    banc.slack[1],
    `:office: ${email} (${email}) — organisation : *La Coop *gras* &lt;https://x|clic&gt;*.`,
  );

  banc.pannes.slack = true;
  try {
    const n = new Navigateur(banc);
    const nouveau = await connecter(n, adresseNeuve("panne-slack"));
    assert.ok(nouveau.id);
    assert.equal((await (await n.get("/api/session")).json()).compte.id, nouveau.id);
  } finally {
    banc.pannes.slack = false;
  }
});

test("Brevo en panne : la demande le dit, sans rien révéler du compte", async () => {
  banc.pannes.brevo = true;
  try {
    const r = await new Navigateur(banc).post("/api/connexion/lien", { email: adresseNeuve("panne") });
    assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), { ok: false, erreur: "ENVOI" });
  } finally {
    banc.pannes.brevo = false;
  }
});
