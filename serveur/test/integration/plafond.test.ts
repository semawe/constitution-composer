// Preuve 4 : deux créations concurrentes au seuil ne dépassent pas cinq
// versions. Et les bornes qui vont avec : nom, taille de charge, quota et
// statut imposé des propositions.

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

before(async () => {
  banc = await ouvrirBanc();
});

after(() => banc.fin());

async function compter(compte: string): Promise<number> {
  const r = await banc.admin.query("select count(*)::int as n from composer.versions where compte_id = $1", [compte]);
  return r.rows[0].n;
}

test("deux insertions concurrentes au seuil, en base : la seconde attend le verrou puis est refusée", async () => {
  const nav = new Navigateur(banc);
  const { id } = await connecter(nav, adresseNeuve("seuil"));
  for (let i = 1; i <= 4; i++)
    assert.equal((await nav.post("/api/versions", { compte: id, nom: `v${i}`, payload: chargeValide() })).status, 201);

  const w1 = new pg.Client({ connectionString: banc.appUrl });
  const w2 = new pg.Client({ connectionString: banc.appUrl });
  await w1.connect();
  await w2.connect();
  try {
    for (const w of [w1, w2]) {
      await w.query("begin");
      await w.query("select set_config('composer.compte', $1, true)", [id]);
    }
    const inserer = "insert into composer.versions (compte_id, nom, payload) values ($1, $2, '{}')";
    await w1.query(inserer, [id, "cinquième, écrivain 1"]);
    let fini = false;
    const p2 = w2.query(inserer, [id, "cinquième, écrivain 2"]).then(
      () => ({ ok: true, code: null as string | null }),
      (e: { code?: string }) => ({ ok: false, code: e.code ?? null }),
    ).finally(() => {
      fini = true;
    });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(fini, false, "le second écrivain attend le verrou consultatif");
    await w1.query("commit");
    assert.deepEqual(await p2, { ok: false, code: "CCLIM" });
    await w2.query("rollback");
  } finally {
    await w1.end();
    await w2.end();
  }
  assert.equal(await compter(id), 5);
});

test("rafale de créations par le service : cinq passent, les autres lèvent LIMIT", async () => {
  const nav = new Navigateur(banc);
  const { id } = await connecter(nav, adresseNeuve("rafale"));
  const reponses = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      nav.post("/api/versions", { compte: id, nom: `r${i}`, payload: chargeValide() }),
    ),
  );
  const statuts = reponses.map((r) => r.status).sort();
  assert.deepEqual(statuts, [...Array(5).fill(201), ...Array(7).fill(409)]);
  for (const r of reponses.filter((x) => x.status === 409))
    assert.deepEqual(await r.json(), { erreur: "LIMIT" });
  assert.equal(await compter(id), 5);
  // Au plafond, figer une version reste possible : c'est une mise à jour.
  const liste = await (await nav.get("/api/versions")).json();
  const r = await nav.post(`/api/versions/${liste.versions[0].id}/remplacer`, { compte: id, payload: chargeValide("figée") });
  assert.equal(r.status, 200);
});

test("bornes : nom de 1 à 120 caractères, charge de 1,5 Mo au plus mesurée non compressée", async () => {
  const nav = new Navigateur(banc);
  const { id } = await connecter(nav, adresseNeuve("bornes"));
  assert.equal((await nav.post("/api/versions", { compte: id, nom: "", payload: chargeValide() })).status, 422);
  assert.equal((await nav.post("/api/versions", { compte: id, nom: "x".repeat(121), payload: chargeValide() })).status, 422);
  // Très compressible : refusée quand même (0008).
  const compressible = { ...chargeValide(), values: "a".repeat(1_600_000) };
  const r = await nav.post("/api/versions", { compte: id, nom: "trop gros", payload: compressible });
  assert.equal(r.status, 413);
  assert.deepEqual(await r.json(), { erreur: "TROP_GROS" });
  const passe = { ...chargeValide(), values: "a".repeat(1_400_000) };
  assert.equal((await nav.post("/api/versions", { compte: id, nom: "1,4 Mo", payload: passe })).status, 201);
  const decl = await nav.post("/api/declaration", { compte: id, payload: { t: "b".repeat(1_600_000) }, revision: 1 });
  assert.equal(decl.status, 413);
});

test("propositions : statut « en attente » imposé, longueurs bornées, vingt au plus", async () => {
  const nav = new Navigateur(banc);
  const { id } = await connecter(nav, adresseNeuve("propositions"));
  const r = await nav.post("/api/propositions", {
    compte: id,
    name: "Mon app",
    kind: "extension",
    integrationPoint: "",
    description: "Une description",
    rationale: "",
    status: "approved",
    admin_note: "forgée",
  });
  assert.equal(r.status, 201);
  const p = (await r.json()).proposition;
  assert.equal(p.status, "pending");
  assert.equal(p.admin_note, null);
  assert.equal(p.reviewed_at, null);
  assert.equal(p.integration_point, null);
  assert.equal(p.user_id, id);
  for (const corps of [
    { name: "x".repeat(121), description: "d" },
    { name: "n", description: "d".repeat(4001) },
    { name: "n", description: "d", rationale: "r".repeat(4001) },
    { name: "n", description: "d", integrationPoint: "i".repeat(201) },
    { name: "n", description: "d", kind: "admin" },
  ])
    assert.equal((await nav.post("/api/propositions", { compte: id, kind: "app", ...corps })).status, 422);

  // En base, le rôle applicatif ne peut pas forger une proposition approuvée.
  const app = new pg.Client({ connectionString: banc.appUrl });
  await app.connect();
  try {
    await app.query("begin");
    await app.query("select set_config('composer.compte', $1, true)", [id]);
    await assert.rejects(
      app.query("insert into composer.propositions (compte_id, nom, description, statut) values ($1, 'n', 'd', 'approved')", [id]),
      (e: { code?: string }) => e.code === "42501",
    );
    await app.query("rollback");
  } finally {
    await app.end();
  }

  for (let i = 2; i <= 20; i++)
    assert.equal((await nav.post("/api/propositions", { compte: id, name: `p${i}`, kind: "app", description: "d" })).status, 201);
  const vingt_et_une = await nav.post("/api/propositions", { compte: id, name: "p21", kind: "app", description: "d" });
  assert.equal(vingt_et_une.status, 409);
  assert.deepEqual(await vingt_et_une.json(), { erreur: "QUOTA" });
  const liste = await (await nav.get("/api/propositions")).json();
  assert.equal(liste.propositions.length, 20);
});
