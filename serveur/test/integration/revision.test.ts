// Preuve 3 : à deux écrivains, la révision de la Déclaration ne recule jamais.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";
import { adresseNeuve, connecter, Navigateur, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;
let onglet1: Navigateur;
let compte: { id: string };

before(async () => {
  banc = await ouvrirBanc();
  onglet1 = new Navigateur(banc);
  compte = await connecter(onglet1, adresseNeuve("deux-onglets"));
});

after(() => banc.fin());

test("verdict lisible par le client : écrite, puis périmée", async () => {
  const ecrire = async (revision: number, marque: string) =>
    (await onglet1.post("/api/declaration", { compte: compte.id, payload: { marque }, revision })).json();
  assert.deepEqual(await ecrire(1, "onglet A"), { compte: compte.id, ecrite: true, revision: 1 });
  assert.deepEqual(await ecrire(2, "onglet B"), { compte: compte.id, ecrite: true, revision: 2 });
  // Refusée, et non « acceptée à 2 ».
  assert.deepEqual(await ecrire(2, "onglet A"), { compte: compte.id, ecrite: false, revision: 2 });
  assert.deepEqual(await ecrire(1, "onglet A"), { compte: compte.id, ecrite: false, revision: 2 });
  const lue = await (await onglet1.get("/api/declaration")).json();
  assert.deepEqual(lue.declaration, { payload: { marque: "onglet B" }, revision: 2 });
  // Bornes : 0 et plus d'un milliard sont refusées.
  for (const revision of [0, 1_000_000_001, 2.5]) {
    const r = await onglet1.post("/api/declaration", { compte: compte.id, payload: {}, revision });
    assert.equal(r.status, 422, String(revision));
  }
});

test("deux écrivains concurrents sur la même révision : le second attend, puis est refusé", async () => {
  const w1 = new pg.Client({ connectionString: banc.appUrl });
  const w2 = new pg.Client({ connectionString: banc.appUrl });
  await w1.connect();
  await w2.connect();
  try {
    for (const w of [w1, w2]) {
      await w.query("begin");
      await w.query("select set_config('composer.compte', $1, true)", [compte.id]);
    }
    const r1 = await w1.query("select composer.save_declaration('{\"m\":\"1\"}'::jsonb, 3, $1) as r", [compte.id]);
    assert.deepEqual(r1.rows[0].r, { ecrite: true, revision: 3 });
    let fini = false;
    const p2 = w2
      .query("select composer.save_declaration('{\"m\":\"2\"}'::jsonb, 3, $1) as r", [compte.id])
      .finally(() => {
        fini = true;
      });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(fini, false, "le second écrivain attend le verrou de ligne");
    await w1.query("commit");
    const r2 = await p2;
    assert.deepEqual(r2.rows[0].r, { ecrite: false, revision: 3 });
    await w2.query("commit");
  } finally {
    await w1.end();
    await w2.end();
  }
  const d = await banc.admin.query("select payload, revision from composer.declarations where compte_id = $1", [compte.id]);
  assert.deepEqual(d.rows[0], { payload: { m: "1" }, revision: "3" });
});

test("rafale de deux onglets : la révision observée ne recule jamais", async () => {
  const onglet2 = new Navigateur(banc);
  onglet2.cookies = new Map(onglet1.cookies);
  const propositions = Array.from({ length: 40 }, (_, i) => ({
    nav: i % 2 ? onglet1 : onglet2,
    proposee: 4 + ((i * 7) % 23),
  }));
  // Un observateur relit la révision en continu pendant la rafale.
  const observees: number[] = [];
  let enCours = true;
  const observateur = (async () => {
    while (enCours) {
      const r = await banc.admin.query("select revision from composer.declarations where compte_id = $1", [compte.id]);
      observees.push(Number(r.rows[0].revision));
    }
  })();
  const verdicts = await Promise.all(
    propositions.map(async ({ nav, proposee }) => {
      const r = await nav.post("/api/declaration", { compte: compte.id, payload: { proposee }, revision: proposee });
      const v = await r.json();
      return { proposee, ecrite: v.ecrite as boolean, revision: v.revision as number };
    }),
  );
  enCours = false;
  await observateur;

  for (let i = 1; i < observees.length; i++) assert.ok(observees[i] >= observees[i - 1], "recul observé");
  for (const v of verdicts) {
    // Écrite : la base porte exactement la révision proposée. Refusée : la base
    // en portait déjà une au moins égale.
    if (v.ecrite) assert.equal(v.revision, v.proposee);
    else assert.ok(v.revision >= v.proposee);
  }
  const max = Math.max(...propositions.map((p) => p.proposee));
  const d = await banc.admin.query("select payload, revision from composer.declarations where compte_id = $1", [compte.id]);
  assert.equal(Number(d.rows[0].revision), max);
  assert.deepEqual(d.rows[0].payload, { proposee: max });
});
