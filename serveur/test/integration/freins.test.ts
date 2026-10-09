// Preuve 7 : les freins d'envoi tiennent — 1 par minute et 5 par heure par
// boîte (sous-adresses et points Gmail confondus), 20 par heure par adresse IP,
// 300 par heure au total. Un refus n'envoie rien.

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, beforeEach, before, test } from "node:test";
import { Navigateur, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;

before(async () => {
  banc = await ouvrirBanc();
});

after(() => banc.fin());

beforeEach(async () => {
  await banc.admin.query("delete from composer.envois");
  banc.courriels.length = 0;
});

/** Vieillit le journal des envois : les fenêtres glissent sans attendre. */
async function vieillir(intervalle: string) {
  await banc.admin.query(`update composer.envois set cree_le = cree_le - interval '${intervalle}'`);
}

const demander = (email: string, ip: string | null = null) =>
  new Navigateur(banc, ip).post("/api/connexion/lien", { email });

test("une demande par minute et par boîte, variantes Gmail comprises", async () => {
  const local = `jean.${randomBytes(3).toString("hex")}`;
  assert.equal((await demander(`${local}@gmail.com`)).status, 202);
  for (const variante of [
    `${local.replace(".", "")}@gmail.com`,
    `${local}+composer@gmail.com`,
    `${local.toUpperCase()}@googlemail.com`,
  ]) {
    const r = await demander(variante);
    assert.equal(r.status, 429, variante);
    assert.deepEqual(await r.json(), { ok: false, erreur: "FREIN" });
  }
  assert.equal(banc.courriels.length, 1);
  await vieillir("61 seconds");
  assert.equal((await demander(`${local}+autre@gmail.com`)).status, 202);
});

test("cinq demandes par heure et par boîte", async () => {
  const boite = `marie-${randomBytes(3).toString("hex")}@exemple.test`;
  for (let i = 0; i < 5; i++) {
    assert.equal((await demander(boite)).status, 202, `demande ${i + 1}`);
    await vieillir("2 minutes");
  }
  assert.equal((await demander(boite)).status, 429);
  assert.equal(banc.courriels.length, 5);
  await vieillir("50 minutes");
  assert.equal((await demander(boite)).status, 202, "la fenêtre d'une heure a glissé");
});

test("vingt demandes par heure et par adresse IP", async () => {
  const ip = "203.0.113.7";
  for (let i = 0; i < 20; i++)
    assert.equal((await demander(`ip-${i}-${randomBytes(3).toString("hex")}@exemple.test`, ip)).status, 202);
  assert.equal((await demander(`ip-21-${randomBytes(3).toString("hex")}@exemple.test`, ip)).status, 429);
  assert.equal((await demander(`autre-ip-${randomBytes(3).toString("hex")}@exemple.test`, "203.0.113.8")).status, 202);
});

test("trois cents demandes par heure au total", async () => {
  await banc.admin.query(
    "insert into composer.envois (boite, ip, cree_le) select 'b' || g || '@x.test', null, now() - interval '10 minutes' from generate_series(1, 300) g",
  );
  const r = await demander(`total-${randomBytes(3).toString("hex")}@exemple.test`);
  assert.equal(r.status, 429);
  assert.equal(banc.courriels.length, 0);
  await vieillir("51 minutes");
  assert.equal((await demander(`total-${randomBytes(3).toString("hex")}@exemple.test`)).status, 202);
});

test("demandes simultanées pour une même boîte : une seule passe", async () => {
  const boite = `simultane-${randomBytes(3).toString("hex")}@exemple.test`;
  const statuts = (await Promise.all(Array.from({ length: 8 }, () => demander(boite)))).map((r) => r.status);
  assert.equal(statuts.filter((s) => s === 202).length, 1);
  assert.equal(statuts.filter((s) => s === 429).length, 7);
});
