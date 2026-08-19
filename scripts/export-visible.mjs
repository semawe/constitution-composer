#!/usr/bin/env node
// Garde de l'export statique : aucun contenu ne part invisible.
//
// Framer Motion écrit son état `initial` dans le balisage rendu côté serveur.
// Une entrée animée livrait donc `style="opacity:0"` dans les fichiers HTML
// servis par OVH : le titre de la page d'arrivée et les six sections du corps
// constitutionnel n'apparaissaient qu'une fois React hydraté, et jamais si le
// bundle échouait ou si la CSP le bloquait. Un lien profond
// (`/composer#article-4`) laissait même sa cible à zéro, l'IntersectionObserver
// ne voyant pas ce qu'on a sauté.
//
// Le garde-fou de source (`src/lib/reveal.test.ts`) interdit le motif le plus
// net, `whileInView`. Il ne peut pas voir les autres : une animation au montage
// ne se distingue d'une animation légitime qu'à l'exécution. Cette garde-ci
// vérifie la propriété qui compte vraiment, sur l'artefact qui part en
// production — et aucune heuristique de lecture de source ne peut la tromper.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const RACINE = "out";

// `opacity:0`, `opacity: 0`, `opacity:0.0` — mais pas `opacity:0.85`.
const INVISIBLE = /opacity:\s*0(?:\.0+)?(?![.0-9])/gi;

async function pagesHtml(dir) {
  let entrees;
  try {
    entrees = await readdir(dir, { withFileTypes: true });
  } catch {
    console.error(
      `Répertoire d'export introuvable : ${dir}\n` +
        "Lance d'abord `npm run build`.",
    );
    process.exit(1);
  }
  const out = [];
  for (const e of entrees) {
    const chemin = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await pagesHtml(chemin)));
    else if (e.name.endsWith(".html")) out.push(chemin);
  }
  return out;
}

const pages = await pagesHtml(RACINE);
if (pages.length === 0) {
  console.error(`Aucune page HTML sous ${RACINE}/ — l'export a-t-il abouti ?`);
  process.exit(1);
}

const fautives = [];
for (const page of pages) {
  const html = await readFile(page, "utf8");
  const trouvés = [...html.matchAll(INVISIBLE)];
  if (trouvés.length > 0) {
    // Un extrait autour de la première occurrence, pour situer le coupable.
    const i = trouvés[0].index ?? 0;
    fautives.push({
      page,
      nombre: trouvés.length,
      extrait: html.slice(Math.max(0, i - 120), i + 40).replace(/\s+/g, " "),
    });
  }
}

if (fautives.length > 0) {
  console.error(
    "L'export statique livre du contenu invisible (`opacity:0` dans le balisage).\n" +
      "Sans JavaScript, ce contenu ne s'affiche jamais.\n",
  );
  for (const f of fautives) {
    console.error(`  ${f.page} — ${f.nombre} occurrence(s)`);
    console.error(`    …${f.extrait}\n`);
  }
  console.error(
    "L'entrée animée se pose en CSS (`.cc-rise` dans src/app/globals.css) :\n" +
      "elle part de l'état visible dans le balisage et son échec n'a aucune\n" +
      "conséquence. Pas d'état `initial` Framer sur du contenu rendu au serveur.",
  );
  process.exit(1);
}

console.log(
  `Export vérifié : ${pages.length} pages, aucun contenu livré invisible.`,
);
