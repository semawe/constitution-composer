// Preuve 5 : une référence de contenu inconnue ou altérée est refusée, à la
// création comme au figement (erreur REFERENCE du client).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  adresseNeuve,
  chargeValide,
  connecter,
  MANIFESTE,
  Navigateur,
  ouvrirBanc,
  referenceCourante,
  type Banc,
} from "./banc.ts";

let banc: Banc;
let nav: Navigateur;
let compte: string;

before(async () => {
  banc = await ouvrirBanc();
  nav = new Navigateur(banc);
  compte = (await connecter(nav, adresseNeuve("reference"))).id;
});

after(() => banc.fin());

const ref = referenceCourante();
const ancienne = MANIFESTE.releases[0];
const refusees: [string, unknown][] = [
  ["release inconnue", { ...ref, release: "2099-01-01" }],
  ["empreinte altérée", { ...ref, sha256: ref.sha256.replace(/^./, (c) => (c === "0" ? "1" : "0")) }],
  ["empreinte absente", { ...ref, sha256: "" }],
  ["empreinte d'une autre release", { ...ref, sha256: ancienne.sha256["constitution.en.json"] }],
  ["langue inconnue", { ...ref, locale: "de" }],
  ["autre fond", { ...ref, kind: "principes" }],
  ["référence absente", undefined],
  ["référence qui n'est pas un objet", "2026-08-19"],
];

test("création : toute référence inconnue ou altérée est refusée, rien n'est écrit", async () => {
  for (const [motif, content] of refusees) {
    const r = await nav.post("/api/versions", { compte, nom: motif, payload: { ...chargeValide(), content } });
    assert.equal(r.status, 422, motif);
    assert.deepEqual(await r.json(), { erreur: "REFERENCE" }, motif);
  }
  const n = await banc.admin.query("select count(*)::int as n from composer.versions");
  assert.equal(n.rows[0].n, 0);
});

test("références admises : la courante, une ancienne, l'anglais, et `kind` absent", async () => {
  const admises = [
    ref,
    { locale: "fr", release: ancienne.id, sha256: ancienne.sha256["constitution.fr.json"], kind: "constitution" },
    referenceCourante("en"),
    { locale: "fr", release: ref.release, sha256: ref.sha256 },
  ];
  for (const content of admises) {
    const r = await nav.post("/api/versions", { compte, nom: "admise", payload: { ...chargeValide(), content } });
    assert.equal(r.status, 201, JSON.stringify(content));
  }
});

test("figement : une référence altérée est refusée et la version reste intacte", async () => {
  const { versions } = await (await nav.get("/api/versions")).json();
  const cible = versions[0];
  for (const [motif, content] of refusees) {
    const r = await nav.post(`/api/versions/${cible.id}/remplacer`, {
      compte,
      payload: { ...chargeValide("altérée"), content },
    });
    assert.equal(r.status, 422, motif);
  }
  const apres = await banc.admin.query("select payload from composer.versions where id = $1", [cible.id]);
  assert.deepEqual(apres.rows[0].payload, cible.payload);
});
