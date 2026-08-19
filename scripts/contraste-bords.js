// Sonde de contraste des bords : la limite d'un contrôle est-elle visible ?
//
// À coller dans la console de la page servie, ou à passer au navigateur piloté.
// Elle ne peut pas tourner sous Node : elle a besoin des styles *calculés* et du
// canevas du navigateur (voir « Deux pièges » plus bas).
//
// Pourquoi cette sonde existe : la WCAG 1.4.11 demande 3:1 sur la limite d'un
// composant d'interface. Avant la passe du 19/08/2026, les quatre valeurs de bord
// des champs échouaient dans les deux thèmes — 1,17:1 en clair, 1,72:1 en sombre.
// Personne ne l'avait vu parce que personne ne l'avait mesuré. Les filets
// décoratifs, eux, sont hors du seuil : la sonde les compte à part.
//
// ── Deux pièges, tous deux rencontrés, tous deux coûteux ─────────────────────
//
// 1. NORMALISER LES COULEURS PAR LE CANEVAS. Tailwind v4 sert sa palette en
//    `lab()` / `oklab()`, et les bords translucides arrivent en
//    `color-mix(in oklab, …)`. Une lecture à la main de `rgb()` donne des
//    nombres absurdes : les soulignements pointillés du glossaire sont apparus à
//    1,18:1 alors qu'ils allaient bien. On peint donc la couleur sur le fond
//    résolu et on relit le pixel.
//
// 2. NE JAMAIS BASCULER LA CLASSE DE THÈME POUR MESURER. Les champs portent
//    `transition` sur `border-color`. Un sous-arbre monté sous un thème puis
//    masqué (`display:none`, ce que fait la barre d'onglets) ne produit aucune
//    image : sa transition reste figée à sa valeur de départ, indéfiniment.
//    `getComputedStyle` rend alors la couleur de l'*autre* thème, et on croit
//    voir un jeton qui se résout à l'envers. C'est ce faux positif qui a fait
//    révoquer une passe de bordures correcte le 19/08/2026, sans que la cause
//    soit comprise.
//    → Mesurer chaque thème après un CHARGEMENT NATIF :
//        localStorage.setItem('cc-theme', 'light'); location.reload();
//      puis relancer la sonde. Idem pour 'dark'.
//
// 3. MONTER LES ONGLETS `ssr: false`. `Principes` et `Marketplace` sont en import
//    dynamique : ils n'existent dans aucun fichier de `out/`, et sur /composer
//    ils ne se montent qu'au clic. Une sonde de l'export statique ne les voit
//    jamais — c'est par ce trou que quatorze sites non convertis sont passés en
//    production. Cliquer chaque onglet avant de mesurer.

(async () => {
  const cnv = document.createElement("canvas");
  cnv.width = cnv.height = 1;
  const g = cnv.getContext("2d", { willReadFrequently: true });

  /** Peint `couleur` sur `fond` et relit le pixel : toute syntaxe CSS y passe. */
  const resolu = (couleur, fond) => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "rgb(" + fond.join(",") + ")";
    g.fillRect(0, 0, 1, 1);
    g.fillStyle = couleur;
    g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const alpha = (couleur) => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = couleur;
    g.fillRect(0, 0, 1, 1);
    return g.getImageData(0, 0, 1, 1).data[3] / 255;
  };
  const lum = (r, v, b) => {
    const c = [r, v, b].map((x) => {
      x /= 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const la = lum(...a),
      lb = lum(...b);
    return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
  };

  const onglet = (re) =>
    [...document.querySelectorAll("button")].find((b) => re.test(b.textContent));

  const releve = () => {
    const fondPage = resolu(getComputedStyle(document.body).backgroundColor, [255, 255, 255]);
    /** Le fond derrière un bord : le premier ancêtre opaque, l'élément compris. */
    const fondDe = (e) => {
      for (let n = e; n; n = n.parentElement) {
        const bc = getComputedStyle(n).backgroundColor;
        if (alpha(bc) > 0.5) return resolu(bc, fondPage);
      }
      return fondPage;
    };
    const stat = {
      champ: { n: 0, pire: Infinity, qui: null },
      filet: { n: 0, pire: Infinity },
      survivants: [],
    };
    for (const e of document.querySelectorAll("*")) {
      if (!e.offsetParent && e.tagName !== "BODY") continue; // seulement le visible
      const cls = String(e.className || "");
      // Un utilitaire neutre encore en place = un site non converti, qui perdra
      // sa valeur sombre le jour où la règle `.dark` correspondante sortira.
      if (/border-slate-(100|200|300)\b/.test(cls)) stat.survivants.push(cls.slice(0, 70));

      const s = getComputedStyle(e);
      const cotes = ["Top", "Right", "Bottom", "Left"].filter(
        (x) => parseFloat(s["border" + x + "Width"]) > 0,
      );
      if (!cotes.length) continue;
      const type = /(^|\s)border-field(\s|$)/.test(cls)
        ? "champ"
        : /(^|\s)border-rule(-soft|-strong)?(\s|$)/.test(cls)
          ? "filet"
          : null;
      if (!type) continue;
      const bc = s["border" + cotes[0] + "Color"];
      if (alpha(bc) < 0.5) continue; // bord volontairement transparent
      const fond = fondDe(e);
      const r = ratio(resolu(bc, fond), fond);
      stat[type].n++;
      if (r < stat[type].pire) {
        stat[type].pire = r;
        if (type === "champ") stat[type].qui = cls.slice(0, 60);
      }
    }
    return stat;
  };

  const SEUIL = 3; // WCAG 1.4.11, limite d'un composant d'interface
  const res = {
    theme: document.documentElement.classList.contains("dark") ? "sombre" : "clair",
    rappel: "thème lu tel quel — ne pas basculer la classe, recharger (voir en-tête)",
  };
  res.Constitution = releve();
  for (const [nom, re] of [
    ["Déclaration", /Déclaration de Principes|Principles/],
    ["App Store", /App Store/],
    ["Glossaire", /Glossaire|Glossary/],
  ]) {
    const b = onglet(re);
    if (!b) continue;
    b.click();
    await new Promise((r) => setTimeout(r, 1300)); // l'onglet se monte
    res[nom] = releve();
  }

  for (const [nom, s] of Object.entries(res)) {
    if (!s || typeof s !== "object") continue;
    const champ = s.champ.n
      ? `${s.champ.n} champs, pire ${s.champ.pire} ${s.champ.pire >= SEUIL ? "✓" : "✗ " + s.champ.qui}`
      : "aucun champ";
    const filet = s.filet.n ? `${s.filet.n} filets, pire ${s.filet.pire} (décor, hors seuil)` : "";
    const surv = s.survivants.length ? ` — ${s.survivants.length} SURVIVANTS` : "";
    console.log(`${nom.padEnd(14)} ${champ}${filet ? " | " + filet : ""}${surv}`);
  }
  return res;
})();
