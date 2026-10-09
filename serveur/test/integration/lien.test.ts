// Preuve 6 : un lien ne sert qu'une fois, expire, et ne s'ouvre pas dans un
// autre navigateur. Et : la demande ne révèle pas si le compte existe ; le
// compte n'est créé qu'à la consommation ; la page de confirmation peut
// consommer par formulaire.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { adresseNeuve, connecter, dernierJeton, Navigateur, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;

before(async () => {
  banc = await ouvrirBanc();
});

after(() => banc.fin());

/** Laisse passer la minute du frein par boîte, sans attendre. */
async function minutePassee() {
  await banc.admin.query("update composer.envois set cree_le = cree_le - interval '2 minutes'");
}

async function comptes(): Promise<number> {
  return (await banc.admin.query("select count(*)::int as n from composer.comptes")).rows[0].n;
}

test("le courriel mène à la page de confirmation, sans effet à l'ouverture", async () => {
  const nav = new Navigateur(banc);
  const adresse = adresseNeuve("confirmation");
  await nav.post("/api/connexion/lien", { email: adresse, retour: "/composer?vue=principes", langue: "en" });
  const courriel = banc.courriels.at(-1)!;
  assert.equal(courriel.a, adresse);
  assert.match(courriel.texte, /^.*https:\/\/composer\.test\/en\/connexion\/confirmer\?jeton=[A-Za-z0-9_-]{43}$/m);
  // Le lien n'est pas une route du service : l'ouvrir ne consomme rien.
  const jeton = dernierJeton(banc, adresse);
  const lien = await banc.admin.query("select utilise_le, retour from composer.liens where expire_le > now() order by cree_le desc limit 1");
  assert.equal(lien.rows[0].utilise_le, null);
  assert.equal(lien.rows[0].retour, "/composer?vue=principes");
  assert.equal(jeton.length, 43);
});

test("la demande ne révèle pas si le compte existe, et ne crée rien", async () => {
  const connu = adresseNeuve("connu");
  await connecter(new Navigateur(banc), connu);
  await minutePassee();
  const avant = await comptes();
  const r1 = await new Navigateur(banc).post("/api/connexion/lien", { email: connu });
  const r2 = await new Navigateur(banc).post("/api/connexion/lien", { email: adresseNeuve("inconnu") });
  assert.equal(r1.status, r2.status);
  assert.deepEqual(await r1.json(), await r2.json());
  assert.equal(await comptes(), avant);
});

test("usage unique : la seconde consommation est refusée, même par le bon navigateur", async () => {
  const nav = new Navigateur(banc);
  const adresse = adresseNeuve("unique");
  await nav.post("/api/connexion/lien", { email: adresse, retour: "/comprendre" });
  const jeton = dernierJeton(banc, adresse);
  const lienCookie = new Map(nav.cookies);
  const r1 = await nav.post("/api/connexion/lien/consommer", { jeton });
  assert.equal(r1.status, 200);
  const corps = await r1.json();
  assert.equal(corps.compte.email, adresse);
  assert.equal(corps.retour, "/comprendre");
  // Même cookie de navigateur, même jeton : refusé.
  const rejoue = new Navigateur(banc);
  rejoue.cookies = lienCookie;
  const r2 = await rejoue.post("/api/connexion/lien/consommer", { jeton });
  assert.equal(r2.status, 410);
  assert.deepEqual(await r2.json(), { erreur: "LIEN_INVALIDE" });
  const sessions = await banc.admin.query("select count(*)::int as n from composer.sessions where compte_id = $1", [corps.compte.id]);
  assert.equal(sessions.rows[0].n, 1);
});

test("expiration : un lien de plus de 30 minutes est refusé", async () => {
  const nav = new Navigateur(banc);
  const adresse = adresseNeuve("expire");
  await nav.post("/api/connexion/lien", { email: adresse });
  const duree = await banc.admin.query(
    "select extract(epoch from expire_le - cree_le)::int as s from composer.liens where email = $1",
    [adresse],
  );
  assert.equal(duree.rows[0].s, 1800);
  await banc.admin.query("update composer.liens set expire_le = now() - interval '1 second' where email = $1", [adresse]);
  const r = await nav.post("/api/connexion/lien/consommer", { jeton: dernierJeton(banc, adresse) });
  assert.equal(r.status, 410);
  assert.equal(nav.cookies.size, 1, "aucune session posée");
});

test("autre navigateur : refusé, et le lien reste au demandeur", async () => {
  const demandeur = new Navigateur(banc);
  const autre = new Navigateur(banc);
  const adresse = adresseNeuve("navigateur");
  await demandeur.post("/api/connexion/lien", { email: adresse });
  const jeton = dernierJeton(banc, adresse);

  const sansCookie = await autre.post("/api/connexion/lien/consommer", { jeton });
  assert.equal(sansCookie.status, 403);
  assert.deepEqual(await sansCookie.json(), { erreur: "NAVIGATEUR" });
  // Un autre navigateur qui a lui-même demandé un lien porte un autre secret.
  await autre.post("/api/connexion/lien", { email: adresseNeuve("autre") });
  const autreSecret = await autre.post("/api/connexion/lien/consommer", { jeton });
  assert.equal(autreSecret.status, 403);
  assert.equal(await comptes().then(() => true), true);
  const avant = await banc.admin.query("select count(*)::int as n from composer.comptes where email = $1", [adresse]);
  assert.equal(avant.rows[0].n, 0, "aucun compte créé par le refus");

  const legitime = await demandeur.post("/api/connexion/lien/consommer", { jeton });
  assert.equal(legitime.status, 200);
});

test("page de confirmation : consommation par formulaire, redirection vers le retour", async () => {
  const nav = new Navigateur(banc);
  const adresse = adresseNeuve("formulaire");
  await nav.post("/api/connexion/lien", { email: adresse, retour: "/composer" });
  const r = await nav.requete("POST", "/api/connexion/lien/consommer", {
    form: { jeton: dernierJeton(banc, adresse), langue: "fr" },
  });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/composer");
  const session = await (await nav.get("/api/session")).json();
  assert.equal(session.compte.email, adresse);
  // Rejoué : renvoyé à la page de confirmation avec le motif.
  const encore = await nav.requete("POST", "/api/connexion/lien/consommer", {
    form: { jeton: dernierJeton(banc, adresse), langue: "en" },
  });
  assert.equal(encore.status, 303);
  assert.equal(encore.headers.get("location"), "/en/connexion/confirmer?erreur=LIEN_INVALIDE");
});

test("adresse normalisée : la casse ne crée pas un second compte, un retour externe est ignoré", async () => {
  const adresse = adresseNeuve("casse");
  const premier = await connecter(new Navigateur(banc), adresse);
  await minutePassee();
  const nav = new Navigateur(banc);
  await nav.post("/api/connexion/lien", { email: adresse.toUpperCase(), retour: "//evil.example/x" });
  const r = await nav.post("/api/connexion/lien/consommer", { jeton: dernierJeton(banc, adresse) });
  const corps = await r.json();
  assert.equal(corps.compte.id, premier.id);
  assert.equal(corps.retour, "/composer");
  assert.equal((await nav.post("/api/connexion/lien", { email: "pas une adresse" })).status, 422);
});
