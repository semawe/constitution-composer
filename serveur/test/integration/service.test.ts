// Le reste du contrat : santé, session (lecture, glissement, sortie), profil,
// en-têtes, et l'adaptateur node:http (limite de corps).

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { ecouteurHttp } from "../../src/serveur.ts";
import { adresseNeuve, connecter, Navigateur, ORIGINE, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;

before(async () => {
  banc = await ouvrirBanc();
});

after(() => banc.fin());

test("santé : lit la base", async () => {
  const r = await new Navigateur(banc).get("/api/sante");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("session : anonyme, connectée, sortie qui supprime la ligne", async () => {
  const nav = new Navigateur(banc);
  assert.deepEqual(await (await nav.get("/api/session")).json(), { compte: null });
  const compte = await connecter(nav, adresseNeuve("session"));
  const lue = await (await nav.get("/api/session")).json();
  assert.deepEqual(Object.keys(lue.compte).sort(), ["email", "id", "nom", "organisation", "prenom"]);
  assert.equal(lue.compte.id, compte.id);
  const jeton = nav.cookies.get("__Host-cc_session")!;
  const sortie = await nav.post("/api/session/sortie", {});
  assert.equal(sortie.status, 200);
  assert.match(sortie.headers.getSetCookie()[0], /^__Host-cc_session=; .*Max-Age=0/);
  const lignes = await banc.admin.query("select count(*)::int as n from composer.sessions where compte_id = $1", [compte.id]);
  assert.equal(lignes.rows[0].n, 0);
  // Le jeton volé avant la sortie ne vaut plus rien.
  const voleur = new Navigateur(banc);
  voleur.cookies.set("__Host-cc_session", jeton);
  assert.deepEqual(await (await voleur.get("/api/session")).json(), { compte: null });
  assert.equal((await voleur.get("/api/versions")).status, 401);
  assert.deepEqual(await (await voleur.get("/api/versions")).json(), { erreur: "AUTH" });
});

test("session : 90 jours glissants, seule l'empreinte du jeton est en base", async () => {
  const nav = new Navigateur(banc);
  const compte = await connecter(nav, adresseNeuve("glisse"));
  const jeton = nav.cookies.get("__Host-cc_session")!;
  const ligne = await banc.admin.query("select empreinte from composer.sessions where compte_id = $1", [compte.id]);
  assert.notEqual(ligne.rows[0].empreinte, jeton);
  assert.equal(ligne.rows[0].empreinte.length, 64);
  // Une session qui vieillit est prolongée et son cookie réémis.
  await banc.admin.query("update composer.sessions set expire_le = now() + interval '10 days' where compte_id = $1", [compte.id]);
  const r = await nav.get("/api/versions");
  assert.match(r.headers.getSetCookie()[0] ?? "", /^__Host-cc_session=.*Max-Age=7776000/);
  const apres = await banc.admin.query("select extract(day from expire_le - now())::int as j from composer.sessions where compte_id = $1", [compte.id]);
  assert.ok(apres.rows[0].j >= 89);
  // Une session expirée ne vaut rien.
  await banc.admin.query("update composer.sessions set expire_le = now() - interval '1 second' where compte_id = $1", [compte.id]);
  assert.equal((await nav.get("/api/versions")).status, 401);
});

test("profil : bornes de 200 caractères, champs absents inchangés", async () => {
  const nav = new Navigateur(banc);
  const compte = await connecter(nav, adresseNeuve("profil"));
  const r = await nav.post("/api/profil", { compte: compte.id, nom: "Nom", prenom: "Prénom", organisation: "Orga" });
  assert.deepEqual((await r.json()).compte, { ...compte, nom: "Nom", prenom: "Prénom", organisation: "Orga" });
  const seule = await nav.post("/api/profil", { compte: compte.id, organisation: "Autre" });
  assert.equal((await seule.json()).compte.nom, "Nom");
  assert.equal((await nav.post("/api/profil", { compte: compte.id, organisation: "o".repeat(201) })).status, 422);
});

test("adaptateur node:http : corps de plus de 2 Mo refusé en 413, cookies multiples transmis", async () => {
  const serveur = createServer(ecouteurHttp(banc.gerer, ORIGINE));
  await new Promise<void>((r) => serveur.listen(0, "127.0.0.1", r));
  const port = (serveur.address() as AddressInfo).port;
  try {
    const gros = await fetch(`http://127.0.0.1:${port}/api/versions`, {
      method: "POST",
      headers: { origin: ORIGINE, "content-type": "application/json" },
      body: "x".repeat(2 * 1024 * 1024 + 1),
    });
    assert.equal(gros.status, 413);
    const sante = await fetch(`http://127.0.0.1:${port}/api/sante`);
    assert.deepEqual(await sante.json(), { ok: true });
  } finally {
    await new Promise((r) => serveur.close(r));
  }
});
