#!/usr/bin/env node
/**
 * Régénère le fond servi par le Composer depuis la source canonique de la
 * Constitution (sous-module `vendor/holacracy-constitution`).
 *
 *   node scripts/fond.mjs            régénère src/data/principes.{fr,en}.json
 *   node scripts/fond.mjs --check    ne réécrit rien, sort en 1 si ça a divergé
 *
 * Le texte canonique humain est le Markdown de `v6-alpha/` : c'est lui qui fait
 * foi. Le JSON n'en est que l'encodage applicatif, et il n'est jamais édité à la
 * main — sans quoi les deux divergent en silence (le défaut que ce script et
 * l'étape CI « Fond synchronisé » corrigent).
 *
 * Ce que le Markdown ne porte pas (l'avertissement affiché quand on décoche un
 * principe, la mention légale, la licence) vit dans les surcouches
 * `src/data/principes.overlay.{fr,en}.json`, appariées par identifiant. Un
 * principe canonique sans avertissement, ou un avertissement orphelin, fait
 * échouer la génération : ajouter un principe amont réclame donc son travail
 * éditorial ici, il ne peut pas passer inaperçu.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUBMODULE = "vendor/holacracy-constitution";

/** @type {{lang: string, source: string, out: string, overlay: string}[]} */
const TARGETS = [
  {
    lang: "fr",
    source: "v6-alpha/fr/HC-v6-principes.md",
    out: "src/data/principes.fr.json",
    overlay: "src/data/principes.overlay.fr.json",
  },
  {
    lang: "en",
    source: "v6-alpha/en/HC-v6-principles.md",
    out: "src/data/principes.en.json",
    overlay: "src/data/principes.overlay.en.json",
  },
];

class FondError extends Error {}

function fail(message) {
  throw new FondError(message);
}

/**
 * Découpe le Markdown canonique.
 *
 * Forme attendue, vérifiée pièce par pièce : un parseur permissif rendrait un
 * JSON cohérent mais amputé, et la garde resterait verte sur une source qu'elle
 * n'a pas comprise.
 *
 *   # <Titre> : <version [candidat N]>
 *   > <chapô, ignoré>
 *   ---
 *   <intro, un ou plusieurs paragraphes>
 *   ---
 *   ## NN. <titre du principe>
 *   <corps, un ou plusieurs paragraphes>
 */
function parseMarkdown(markdown, sourcePath) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  const h1 = lines.find((l) => l.startsWith("# "));
  if (!h1) fail(`${sourcePath} : titre de niveau 1 introuvable.`);

  const titled = /^#\s+(.+?)\s*:\s*(.+?)\s*$/.exec(h1);
  if (!titled) {
    fail(`${sourcePath} : le titre « ${h1} » n'a pas la forme « # Titre : version ».`);
  }
  const [, title, rawVersion] = titled;

  // « v6 [candidat 3] » à l'écrit devient « v6, candidat 3 » en interface :
  // les crochets signalent un état d'avancement, pas une notation de version.
  const bracketed = /^(.*?)\s*\[(.+)\]$/.exec(rawVersion);
  if (!bracketed) {
    fail(`${sourcePath} : version « ${rawVersion} » attendue sous la forme « v6 [candidat 3] ».`);
  }
  const version = `${bracketed[1]}, ${bracketed[2]}`;

  const separators = [];
  lines.forEach((l, i) => {
    if (l.trim() === "---") separators.push(i);
  });
  if (separators.length < 2) {
    fail(`${sourcePath} : les deux séparateurs « --- » encadrant l'introduction sont attendus.`);
  }

  const intro = paragraphs(lines.slice(separators[0] + 1, separators[1])).join("\n\n");
  if (!intro) fail(`${sourcePath} : introduction vide entre les deux séparateurs.`);

  const principles = [];
  const body = lines.slice(separators[1] + 1);
  let current = null;
  for (const line of body) {
    const heading = /^##\s+(\d+)\.\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) principles.push(current);
      const [, n, principleTitle] = heading;
      current = { n, title: principleTitle, lines: [] };
      continue;
    }
    if (line.startsWith("## ")) {
      fail(`${sourcePath} : titre de principe « ${line} » sans numérotation « ## NN. ».`);
    }
    if (current) current.lines.push(line);
  }
  if (current) principles.push(current);

  if (principles.length === 0) fail(`${sourcePath} : aucun principe « ## NN. Titre » trouvé.`);

  return {
    title,
    version,
    intro,
    principles: principles.map(({ n, title: principleTitle, lines: bodyLines }) => {
      const text = paragraphs(bodyLines).join("\n\n");
      if (!text) fail(`${sourcePath} : le principe ${n} n'a pas de corps de texte.`);
      return { id: `p${n}`, n, title: principleTitle, text };
    }),
  };
}

/** Regroupe des lignes en paragraphes, séparés par une ou plusieurs lignes vides. */
function paragraphs(lines) {
  const out = [];
  let buffer = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (buffer.length) out.push(buffer.join(" ").trim());
      buffer = [];
    } else {
      buffer.push(line.trim());
    }
  }
  if (buffer.length) out.push(buffer.join(" ").trim());
  return out.filter(Boolean);
}

function readOverlay(path) {
  const overlay = JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
  for (const key of ["notice", "license", "warnings"]) {
    if (!(key in overlay)) fail(`${path} : clé « ${key} » manquante.`);
  }
  return overlay;
}

function buildDocument({ lang, source, overlay: overlayPath }) {
  const sourceFile = resolve(ROOT, SUBMODULE, source);
  let markdown;
  try {
    markdown = readFileSync(sourceFile, "utf8");
  } catch {
    fail(
      `Source canonique introuvable : ${SUBMODULE}/${source}\n` +
        "Le sous-module n'est pas initialisé. Lance :\n" +
        "  git submodule update --init --recursive",
    );
  }

  const parsed = parseMarkdown(markdown, `${SUBMODULE}/${source}`);
  const overlay = readOverlay(overlayPath);

  const ids = parsed.principles.map((p) => p.id);
  const warned = Object.keys(overlay.warnings);
  const missing = ids.filter((id) => !warned.includes(id));
  const orphans = warned.filter((id) => !ids.includes(id));
  if (missing.length || orphans.length) {
    fail(
      `${overlayPath} : surcouche désalignée sur ${SUBMODULE}/${source}.\n` +
        (missing.length ? `  avertissement manquant pour : ${missing.join(", ")}\n` : "") +
        (orphans.length ? `  avertissement orphelin pour : ${orphans.join(", ")}\n` : "") +
        "  Un principe amont réclame son avertissement côté application.",
    );
  }

  return {
    lang,
    document: {
      meta: {
        title: parsed.title,
        version: parsed.version,
        source: `holacracy-constitution/${source}`,
        notice: overlay.notice,
        license: overlay.license,
      },
      intro: parsed.intro,
      principles: parsed.principles.map((p) => ({ ...p, warning: overlay.warnings[p.id] })),
    },
  };
}

function serialize(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function main() {
  const check = process.argv.includes("--check");
  const diverged = [];

  for (const target of TARGETS) {
    const { document } = buildDocument(target);
    const generated = serialize(document);
    const outPath = resolve(ROOT, target.out);

    let current = null;
    try {
      current = readFileSync(outPath, "utf8");
    } catch {
      /* fichier absent : traité comme une divergence */
    }

    if (current === generated) {
      if (!check) console.log(`= ${target.out} (inchangé)`);
      continue;
    }

    if (check) {
      diverged.push(target.out);
      continue;
    }

    writeFileSync(outPath, generated);
    console.log(`${current === null ? "+" : "~"} ${target.out}`);
  }

  if (diverged.length) {
    console.error(
      "Le fond du Composer a divergé de la source canonique.\n" +
        diverged.map((f) => `  ${f}`).join("\n") +
        `\n\nCes fichiers sont générés depuis ${SUBMODULE}/v6-alpha/ : ne les édite pas à la main.` +
        "\nRégénère-les et committe le résultat :\n" +
        "  git submodule update --init --recursive\n" +
        "  npm run fond:build\n",
    );
    process.exit(1);
  }

  if (check) console.log("Fond synchronisé avec la source canonique.");
}

try {
  main();
} catch (error) {
  if (error instanceof FondError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
