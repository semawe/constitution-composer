#!/usr/bin/env node
// Empreinte DOM de l'export statique : la preuve qu'une reprise visuelle n'a
// rien changé au contenu servi.
//
// Une refonte de mise en page touche des dizaines de classes dans une dizaine de
// fichiers. Rien, dans `tsc`, `lint` ou les tests, ne dit si un paragraphe a
// disparu, si une ancre a bougé ou si une commande n'est plus atteignable. Cette
// empreinte le dit : elle ignore délibérément les classes et la structure — c'est
// ce que la reprise change — et retient les trois choses qui doivent survivre.
//
//   texte      tout le texte servi, espaces normalisés. Un mot en moins se voit.
//   ancres     les `id` de la page, triés. Un lien profond qui casse se voit.
//   commandes  boutons, liens, champs, étiquettes, par nom accessible, triés.
//              Un contrôle devenu inatteignable se voit.
//
// Usage :
//
//   npm run build
//   node scripts/empreinte-dom.mjs avant.txt
//   … la reprise …
//   npm run build
//   node scripts/empreinte-dom.mjs apres.txt
//   diff avant.txt apres.txt
//
// Lire le diff, et non son volume : le tampon de build du pied de page contient
// le SHA du commit, donc **deux builds de commits différents diffèrent toujours
// d'une ligne par page**. C'est le seul écart attendu.
//
// Un diff par mot est plus lisible qu'un diff par ligne quand du contenu se
// déplace, la sortie joignant les nœuds adjacents sans espace :
//
//   tr -s ' ' '\n' < avant.txt | sort > a && tr -s ' ' '\n' < apres.txt | sort > b
//   diff a b
//
// Ce que cette empreinte ne voit pas, et il faut le savoir : les onglets montés
// en `ssr: false` (`Principes`, `Marketplace`) n'existent dans aucun fichier de
// `out/`. Ils se vérifient au navigateur, onglet monté — voir
// `scripts/contraste-bords.js`.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const RACINE = "out";

const sortie = process.argv[2];
if (!sortie) {
  console.error("usage : node scripts/empreinte-dom.mjs <fichier-de-sortie>");
  process.exit(1);
}

async function pagesHtml(dir) {
  let entrees;
  try {
    entrees = await readdir(dir, { withFileTypes: true });
  } catch {
    console.error(
      `Répertoire d'export introuvable : ${dir}\nLance d'abord \`npm run build\`.`,
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

const pages = (await pagesHtml(RACINE)).sort();
if (pages.length === 0) {
  console.error(`Aucune page HTML sous ${RACINE}/ — l'export a-t-il abouti ?`);
  process.exit(1);
}

const lignes = [];
for (const page of pages) {
  const { window } = new JSDOM(await readFile(page, "utf8"));
  const doc = window.document;
  // Le script d'en-tête (thème, bandeau) et les styles ne sont pas du contenu.
  for (const n of doc.querySelectorAll("script,style,noscript")) n.remove();

  const texte = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const ancres = [...doc.querySelectorAll("[id]")].map((e) => e.id).sort();
  const commandes = [
    ...doc.querySelectorAll("button,a,input,select,textarea,label"),
  ]
    .map((e) => {
      // Nom accessible, dans l'ordre où un lecteur d'écran le cherche.
      const nom = (
        e.getAttribute("aria-label") ||
        e.getAttribute("title") ||
        e.textContent ||
        e.getAttribute("placeholder") ||
        e.getAttribute("href") ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();
      const type = e.getAttribute("type");
      return `${e.tagName.toLowerCase()}${type ? `[${type}]` : ""}:${nom}`;
    })
    .sort();

  lignes.push(`### ${page}`);
  lignes.push(`texte(${texte.length}) ${texte}`);
  lignes.push(`ancres(${ancres.length}) ${ancres.join(" ")}`);
  lignes.push(`commandes(${commandes.length})`);
  for (const c of commandes) lignes.push(`  ${c}`);
  lignes.push("");
}

await writeFile(sortie, lignes.join("\n"));
console.log(
  `Empreinte écrite : ${sortie} — ${pages.length} pages, ${lignes.length} lignes.`,
);
