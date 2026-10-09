// Preuve 2 : une écriture préparée pour un autre compte est refusée (403) et
// n'écrit rien — Déclaration, versions, propositions, profil. Le contrôle tient
// aussi dans la fonction en base, sans le serveur (épreuve manuelle de 0010,
// automatisée).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";
import {
  adresseNeuve,
  chargeValide,
  connecter,
  Navigateur,
  ouvrirBanc,
  type Banc,
} from "./banc.ts";

let banc: Banc;
let a: Navigateur;
let b: Navigateur;
let compteA: { id: string };
let compteB: { id: string };
let versionB: string;

async function etat() {
  const r = await banc.admin.query(`select
    (select count(*) from composer.versions)::int as versions,
    (select count(*) from composer.propositions)::int as propositions,
    (select coalesce(json_agg(json_build_object('c', compte_id, 'p', payload, 'r', revision) order by compte_id), '[]') from composer.declarations) as declarations,
    (select coalesce(json_agg(json_build_object('c', compte_id, 'o', organisation, 'n', nom) order by compte_id), '[]') from composer.profils) as profils,
    (select coalesce(json_agg(json_build_object('n', nom, 'p', payload) order by id), '[]') from composer.versions) as contenu`);
  return r.rows[0];
}

before(async () => {
  banc = await ouvrirBanc();
  a = new Navigateur(banc);
  b = new Navigateur(banc);
  compteA = await connecter(a, adresseNeuve("a"));
  compteB = await connecter(b, adresseNeuve("b"));
  const v = await b.post("/api/versions", { compte: compteB.id, nom: "de B", payload: chargeValide() });
  versionB = (await v.json()).version.id;
  await b.post("/api/declaration", { compte: compteB.id, payload: { de: "B" }, revision: 1 });
});

after(() => banc.fin());

test("écriture préparée pour A, envoyée sous la session de B : 403, rien d'écrit", async () => {
  const avant = await etat();
  const tentatives: [string, Record<string, unknown>][] = [
    ["/api/declaration", { payload: { de: "A, sous B" }, revision: 2 }],
    ["/api/versions", { nom: "de A, sous B", payload: chargeValide() }],
    [`/api/versions/${versionB}/renommer`, { nom: "renommée sous B" }],
    [`/api/versions/${versionB}/remplacer`, { payload: chargeValide("remplacée") }],
    [`/api/versions/${versionB}/supprimer`, {}],
    ["/api/propositions", { name: "x", kind: "app", description: "y" }],
    ["/api/profil", { organisation: "Organisation de A" }],
  ];
  for (const [chemin, corps] of tentatives) {
    const r = await b.post(chemin, { ...corps, compte: compteA.id });
    assert.equal(r.status, 403, chemin);
    assert.deepEqual(await r.json(), { erreur: "COMPTE" }, chemin);
    // Sans compte destinataire : refusé de même.
    const sans = await b.post(chemin, corps);
    assert.equal(sans.status, 403, `${chemin} sans compte`);
  }
  assert.deepEqual(await etat(), avant);
  assert.equal(banc.slack.filter((m) => m.includes("Organisation de A")).length, 0);
});

test("la fonction en base refuse une charge préparée pour un autre compte (0010)", async () => {
  const app = new pg.Client({ connectionString: banc.appUrl });
  await app.connect();
  try {
    await app.query("begin");
    await app.query("select set_config('composer.compte', $1, true)", [compteB.id]);
    await assert.rejects(
      app.query("select composer.save_declaration('{\"de\":\"A\"}'::jsonb, 9, $1::uuid)", [compteA.id]),
      (e: { code?: string }) => e.code === "42501",
    );
    await app.query("rollback");
    // Sans compte déclaré, rien ne s'écrit non plus.
    await assert.rejects(
      app.query("select composer.save_declaration('{}'::jsonb, 9)"),
      (e: { code?: string }) => e.code === "42501",
    );
  } finally {
    await app.end();
  }
  const d = await banc.admin.query("select payload, revision from composer.declarations where compte_id = $1", [compteB.id]);
  assert.deepEqual(d.rows[0], { payload: { de: "B" }, revision: "1" });
});
