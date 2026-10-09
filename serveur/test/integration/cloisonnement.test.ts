// Preuve 1 : le compte A ne lit ni n'écrit rien du compte B.
// Par le service (HTTP), puis directement en base avec le rôle applicatif.

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
let versionA: string;

before(async () => {
  banc = await ouvrirBanc();
  a = new Navigateur(banc);
  b = new Navigateur(banc);
  compteA = await connecter(a, adresseNeuve("a"));
  compteB = await connecter(b, adresseNeuve("b"));
  const v = await a.post("/api/versions", { compte: compteA.id, nom: "de A", payload: chargeValide() });
  assert.equal(v.status, 201);
  versionA = (await v.json()).version.id;
  const d = await a.post("/api/declaration", { compte: compteA.id, payload: { de: "A" }, revision: 1 });
  assert.equal((await d.json()).ecrite, true);
  const p = await a.post("/api/propositions", {
    compte: compteA.id,
    name: "App de A",
    kind: "app",
    description: "Proposée par A",
  });
  assert.equal(p.status, 201);
  await a.post("/api/profil", { compte: compteA.id, organisation: "Organisation de A" });
});

after(() => banc.fin());

test("cloisonnement HTTP : B ne lit rien de A", async () => {
  const versions = await (await b.get("/api/versions")).json();
  assert.deepEqual(versions, { compte: compteB.id, versions: [] });
  const declaration = await (await b.get("/api/declaration")).json();
  assert.deepEqual(declaration, { compte: compteB.id, declaration: null });
  const propositions = await (await b.get("/api/propositions")).json();
  assert.deepEqual(propositions, { compte: compteB.id, propositions: [] });
  const session = await (await b.get("/api/session")).json();
  assert.equal(session.compte.id, compteB.id);
  assert.equal(session.compte.organisation, null);
  // Demander la Déclaration de A en se nommant A : refusé.
  assert.equal((await b.get(`/api/declaration?compte=${compteA.id}`)).status, 403);
});

test("cloisonnement HTTP : B n'écrit rien chez A", async () => {
  for (const action of ["renommer", "remplacer", "supprimer"]) {
    const r = await b.post(`/api/versions/${versionA}/${action}`, {
      compte: compteB.id,
      nom: "pris par B",
      payload: chargeValide("pris par B"),
    });
    assert.equal(r.status, 404, action);
  }
  // La Déclaration de B s'écrit dans la ligne de B, jamais dans celle de A.
  const d = await b.post("/api/declaration", { compte: compteB.id, payload: { de: "B" }, revision: 5 });
  assert.equal((await d.json()).ecrite, true);

  const versionsA = await (await a.get("/api/versions")).json();
  assert.equal(versionsA.versions.length, 1);
  assert.equal(versionsA.versions[0].name, "de A");
  assert.equal(versionsA.versions[0].payload.title, "Constitution d'essai");
  const declA = await (await a.get("/api/declaration")).json();
  assert.deepEqual(declA.declaration, { payload: { de: "A" }, revision: 1 });
});

test("cloisonnement en base : le rôle applicatif ne contourne pas la sécurité par ligne", async () => {
  const role = await banc.admin.query(
    "select rolsuper, rolbypassrls from pg_roles where rolname = 'composer_app'",
  );
  assert.deepEqual(role.rows[0], { rolsuper: false, rolbypassrls: false });
  const proprietaires = await banc.admin.query(
    `select distinct tableowner from pg_tables where schemaname = 'composer'`,
  );
  assert.deepEqual(proprietaires.rows, [{ tableowner: "composer_owner" }]);
  const rls = await banc.admin.query(
    `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'composer' and c.relrowsecurity order by relname`,
  );
  assert.deepEqual(
    rls.rows.map((r) => r.relname),
    ["declarations", "profils", "propositions", "versions"],
  );

  const app = new pg.Client({ connectionString: banc.appUrl });
  await app.connect();
  try {
    // Sans compte déclaré, aucun document n'est visible.
    for (const table of ["versions", "declarations", "propositions", "profils"]) {
      const r = await app.query(`select count(*)::int as n from composer.${table}`);
      assert.equal(r.rows[0].n, 0, table);
    }
    // Compte B déclaré : rien de A, ni en lecture, ni en écriture.
    await app.query("begin");
    await app.query("select set_config('composer.compte', $1, true)", [compteB.id]);
    const vues = await app.query("select compte_id from composer.versions");
    assert.equal(vues.rowCount, 0);
    const maj = await app.query("update composer.versions set nom = 'B' where id = $1", [versionA]);
    assert.equal(maj.rowCount, 0);
    const sup = await app.query("delete from composer.versions where id = $1", [versionA]);
    assert.equal(sup.rowCount, 0);
    const decl = await app.query("update composer.declarations set revision = 999 where compte_id = $1", [compteA.id]);
    assert.equal(decl.rowCount, 0);
    await assert.rejects(
      app.query(
        "insert into composer.versions (compte_id, nom, payload) values ($1, 'forgée', '{}')",
        [compteA.id],
      ),
      (e: { code?: string }) => e.code === "42501",
    );
    await app.query("rollback");
    // Le rôle applicatif ne touche pas au registre des migrations.
    await assert.rejects(app.query("select * from public.schema_migrations"), (e: { code?: string }) => e.code === "42501");
  } finally {
    await app.end();
  }
  const intact = await banc.admin.query("select nom from composer.versions where id = $1", [versionA]);
  assert.equal(intact.rows[0].nom, "de A");
});
