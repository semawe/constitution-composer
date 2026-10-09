// Le logo d'une version, contrôlé par le serveur.
//
// Le pare-feu applicatif de l'instance sort `payload.logo` de l'inspection du
// CRS sur les routes des versions (deploy/nginx) : le service est donc seul à
// le contrôler, à la création comme au figement.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { adresseNeuve, chargeValide, connecter, Navigateur, ouvrirBanc, type Banc } from "./banc.ts";

let banc: Banc;
let nav: Navigateur;
let compte: string;

before(async () => {
  banc = await ouvrirBanc();
  nav = new Navigateur(banc);
  compte = (await connecter(nav, adresseNeuve("logo"))).id;
});

after(() => banc.fin());

const PNG = `data:image/png;base64,${"iVBORw0KGgo".padEnd(1_000_000, "A")}`;
const refuses: [string, unknown][] = [
  ["URL externe", "https://exemple.test/pixel.png"],
  ["SVG", "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"],
  ["HTML", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
  ["base64 altéré", "data:image/png;base64,<script>"],
  ["trop long", `data:image/png;base64,${"A".repeat(1_500_000)}`],
  ["pas une chaîne", { src: PNG }],
];

test("création : un logo raster d'un million de caractères passe, le reste est refusé sans rien écrire", async () => {
  const r = await nav.post("/api/versions", { compte, nom: "avec logo", payload: { ...chargeValide(), logo: PNG } });
  assert.equal(r.status, 201);
  for (const [motif, logo] of refuses) {
    const refus = await nav.post("/api/versions", { compte, nom: motif, payload: { ...chargeValide(), logo } });
    assert.equal(refus.status, 422, motif);
    assert.deepEqual(await refus.json(), { erreur: "LOGO" }, motif);
  }
  const n = await banc.admin.query("select count(*)::int as n from composer.versions where compte_id = $1", [compte]);
  assert.equal(n.rows[0].n, 1);
});

test("figement : un logo refusé laisse la version intacte", async () => {
  const { versions } = await (await nav.get("/api/versions")).json();
  const cible = versions[0];
  for (const [motif, logo] of refuses) {
    const r = await nav.post(`/api/versions/${cible.id}/remplacer`, {
      compte,
      payload: { ...chargeValide("figée"), logo },
    });
    assert.equal(r.status, 422, motif);
  }
  const apres = await banc.admin.query("select payload->>'logo' as logo from composer.versions where id = $1", [cible.id]);
  assert.equal(apres.rows[0].logo, PNG);
  const sansLogo = await nav.post(`/api/versions/${cible.id}/remplacer`, { compte, payload: chargeValide("figée") });
  assert.equal(sansLogo.status, 200);
});
