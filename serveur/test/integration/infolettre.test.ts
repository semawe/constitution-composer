// Nouvelles du Composer (tâche ERP 846) : la case est facultative ; seul un
// consentement confirmé par une connexion réussie rejoint la liste Brevo ; une
// panne de Brevo ne fait pas échouer la connexion et se rattrape.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { synchroniser } from "../../src/infolettre.ts";
import {
  adresseNeuve,
  dernierJeton,
  LISTE_INSCRITS,
  Navigateur,
  ouvrirBanc,
  type Banc,
} from "./banc.ts";

let banc: Banc;

before(async () => {
  banc = await ouvrirBanc();
});

after(() => banc.fin());

async function parLien(adresse: string, infolettre?: boolean) {
  const nav = new Navigateur(banc);
  const demande = await nav.post("/api/connexion/lien", { email: adresse, retour: "/composer", infolettre });
  assert.equal(demande.status, 202);
  return { nav, jeton: dernierJeton(banc, adresse) };
}

async function consentement(adresse: string) {
  const { rows } = await banc.admin.query(
    `select i.origine, i.consenti_le, i.synchro_le, i.essais
       from composer.infolettre i join composer.comptes c on c.id = i.compte_id
      where c.email = $1`,
    [adresse],
  );
  return rows[0] ?? null;
}

test("case non cochée : compte créé, rien chez Brevo", async () => {
  const adresse = adresseNeuve("sans-case");
  const { nav, jeton } = await parLien(adresse);
  assert.equal((await nav.post("/api/connexion/lien/consommer", { jeton })).status, 200);
  assert.equal(await consentement(adresse), null);
  assert.equal(banc.inscrits.some((i) => i.email === adresse), false);
});

test("case cochée : rien tant que le lien n'est pas consommé, puis la liste", async () => {
  const adresse = adresseNeuve("avec-case");
  const { nav, jeton } = await parLien(adresse, true);
  // Demander pour une adresse ne prouve rien : on peut taper celle d'un tiers.
  assert.equal(banc.inscrits.some((i) => i.email === adresse), false);
  assert.equal(await consentement(adresse), null);
  assert.equal((await nav.post("/api/connexion/lien/consommer", { jeton })).status, 200);
  const c = await consentement(adresse);
  assert.equal(c.origine, "lien");
  assert.ok(c.consenti_le instanceof Date);
  assert.ok(c.synchro_le instanceof Date);
  assert.deepEqual(banc.inscrits.filter((i) => i.email === adresse), [
    { email: adresse, listIds: [LISTE_INSCRITS] },
  ]);
});

test("une valeur autre que true ne vaut pas consentement", async () => {
  const adresse = adresseNeuve("vrai-texte");
  const nav = new Navigateur(banc);
  await nav.post("/api/connexion/lien", { email: adresse, infolettre: "true" });
  await nav.post("/api/connexion/lien/consommer", { jeton: dernierJeton(banc, adresse) });
  assert.equal(await consentement(adresse), null);
});

test("Brevo en panne : la connexion aboutit, la relance rattrape l'inscription", async () => {
  const adresse = adresseNeuve("panne");
  const { nav, jeton } = await parLien(adresse, true);
  banc.pannes.contacts = true;
  try {
    assert.equal((await nav.post("/api/connexion/lien/consommer", { jeton })).status, 200);
  } finally {
    banc.pannes.contacts = false;
  }
  const avant = await consentement(adresse);
  assert.equal(avant.synchro_le, null);
  assert.equal(avant.essais, 1);
  await synchroniser(
    banc.pool,
    { cle: "cle-test", expediteur: { email: "c@composer.test", name: "C" }, listeInscrits: LISTE_INSCRITS },
    async (url, init) => {
      if (url !== "https://api.brevo.com/v3/contacts") throw new Error(url);
      banc.inscrits.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    },
    () => {},
  );
  assert.ok((await consentement(adresse)).synchro_le instanceof Date);
  assert.equal(banc.inscrits.filter((i) => i.email === adresse).length, 1);
});

test("Google : la case cochée au départ inscrit, une seule fois", async () => {
  const email = adresseNeuve("google-case");
  for (let i = 0; i < 2; i++) {
    const nav = new Navigateur(banc);
    const depart = await nav.get("/api/connexion/google?retour=%2Fcomposer&infolettre=1");
    const google = new URL(depart.headers.get("location")!);
    banc.google.prochainJeton = await banc.jetonGoogle({
      sub: "g-infolettre",
      email,
      nonce: google.searchParams.get("nonce"),
    });
    const r = await nav.get(
      `/api/connexion/google/retour?code=c&state=${encodeURIComponent(google.searchParams.get("state")!)}`,
    );
    assert.equal(r.status, 303);
  }
  assert.equal((await consentement(email)).origine, "google");
  assert.equal(banc.inscrits.filter((i) => i.email === email).length, 1);
});
