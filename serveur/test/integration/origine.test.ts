// Preuve 8 : une écriture sans origine, ou d'une autre origine, est refusée,
// et rien n'est écrit. Toutes les routes POST y passent ; les autres méthodes
// n'écrivent pas (PATCH et DELETE n'existent pas).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  adresseNeuve,
  chargeValide,
  connecter,
  dernierJeton,
  Navigateur,
  ouvrirBanc,
  type Banc,
} from "./banc.ts";

let banc: Banc;
let nav: Navigateur;
let compte: string;
let version: string;

async function photographie() {
  const r = await banc.admin.query(`select
    (select count(*) from composer.versions)::int as versions,
    (select count(*) from composer.propositions)::int as propositions,
    (select count(*) from composer.sessions)::int as sessions,
    (select count(*) from composer.liens)::int as liens,
    (select count(*) from composer.comptes)::int as comptes,
    (select coalesce(json_agg(json_build_object('n', nom, 'p', payload)), '[]') from composer.versions) as contenu,
    (select coalesce(json_agg(json_build_object('p', payload, 'r', revision)), '[]') from composer.declarations) as declarations,
    (select coalesce(json_agg(organisation), '[]') from composer.profils) as profils`);
  return r.rows[0];
}

before(async () => {
  banc = await ouvrirBanc();
  nav = new Navigateur(banc);
  compte = (await connecter(nav, adresseNeuve("origine"))).id;
  version = (await (await nav.post("/api/versions", { compte, nom: "v", payload: chargeValide() })).json()).version.id;
});

after(() => banc.fin());

test("toute route POST refuse une écriture sans origine ou d'une autre origine", async () => {
  // Un lien en attente, pour éprouver aussi la consommation.
  const tiers = new Navigateur(banc);
  const adresse = adresseNeuve("lien-origine");
  await tiers.post("/api/connexion/lien", { email: adresse });
  const jeton = dernierJeton(banc, adresse);

  const routes: [string, Record<string, unknown>][] = [
    ["/api/session/sortie", {}],
    ["/api/connexion/lien", { email: adresseNeuve("x") }],
    ["/api/connexion/lien/consommer", { jeton }],
    ["/api/profil", { compte, organisation: "Forgée" }],
    ["/api/versions", { compte, nom: "forgée", payload: chargeValide() }],
    [`/api/versions/${version}/renommer`, { compte, nom: "forgée" }],
    [`/api/versions/${version}/remplacer`, { compte, payload: chargeValide("forgée") }],
    [`/api/versions/${version}/supprimer`, { compte }],
    ["/api/declaration", { compte, payload: { forgee: true }, revision: 7 }],
    ["/api/propositions", { compte, name: "forgée", kind: "app", description: "d" }],
  ];
  const avant = await photographie();
  const envoisAvant = banc.courriels.length;
  for (const [chemin, corps] of routes) {
    for (const origine of [null, "https://evil.example", "http://composer.test", "null"]) {
      const qui = chemin === "/api/connexion/lien/consommer" ? tiers : nav;
      const r = await qui.post(chemin, corps, origine);
      assert.equal(r.status, 403, `${chemin} depuis ${origine}`);
      assert.deepEqual(await r.json(), { erreur: "ORIGINE" }, `${chemin} depuis ${origine}`);
    }
  }
  assert.deepEqual(await photographie(), avant);
  assert.equal(banc.courriels.length, envoisAvant);
  // La session n'a pas été fermée, le lien reste consommable par son demandeur.
  assert.equal((await (await nav.get("/api/session")).json()).compte.id, compte);
  assert.equal((await tiers.post("/api/connexion/lien/consommer", { jeton })).status, 200);
});

test("PATCH, PUT et DELETE ne sont pas des routes", async () => {
  for (const methode of ["PATCH", "PUT", "DELETE"]) {
    const r = await nav.requete(methode, `/api/versions/${version}`, { json: { compte } });
    assert.equal(r.status, 404, methode);
  }
});
