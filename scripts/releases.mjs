#!/usr/bin/env node
/**
 * Archive les releases du fond, pour qu'une version sauvegardée reste le
 * document qu'elle était.
 *
 *   node scripts/releases.mjs --new [--label <id>]   archive le fond courant
 *   node scripts/releases.mjs --check                vérifie l'archive et l'index
 *
 * Le problème réglé ici : une composition sauvegardée ne portait que sa
 * configuration (modules cochés, titre, valeurs). Après une retouche éditoriale
 * du fond, la rouvrir et l'exporter produisait un autre texte juridique sous le
 * même nom, sans un mot. Une organisation qui a adopté sa Constitution doit
 * pouvoir la rééditer telle qu'elle l'a ratifiée.
 *
 * Le dispositif : chaque état du fond servi est copié une fois pour toutes dans
 * `src/data/releases/<id>/`, avec l'empreinte de chaque fichier. Les copies ne
 * sont jamais réécrites — `--check` échoue si l'une d'elles a bougé, et échoue
 * aussi si le fond courant a divergé de la release la plus récente sans qu'une
 * nouvelle ait été créée. Sans cette seconde garde, la dérive reviendrait par
 * la porte qu'on vient de fermer.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const RELEASES = join(DATA, "releases");
const MANIFEST = join(RELEASES, "manifest.json");
const INDEX = join(RELEASES, "index.ts");
const LOCALES = ["fr", "en"];

class ReleaseError extends Error {}

function fail(message) {
  throw new ReleaseError(message);
}

/** Empreinte du fichier tel qu'il est écrit : ni reformatage, ni canonisation. */
function empreinte(chemin) {
  return createHash("sha256").update(readFileSync(chemin)).digest("hex");
}

function fondCourant(locale) {
  return join(DATA, `constitution.${locale}.json`);
}

function lireManifeste() {
  if (!existsSync(MANIFEST)) return { releases: [] };
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

/** La release la plus récente est la dernière du tableau : l'ordre est l'histoire. */
function derniere(manifeste) {
  return manifeste.releases[manifeste.releases.length - 1] ?? null;
}

function identifiantDuJour(manifeste, label) {
  if (label) {
    if (!/^[0-9A-Za-z._-]+$/.test(label))
      fail(`Identifiant de release invalide : ${JSON.stringify(label)}.`);
    if (manifeste.releases.some((r) => r.id === label))
      fail(`La release ${label} existe déjà : une archive ne se réécrit pas.`);
    return label;
  }
  // Pas d'appel à Date() : la date vient de l'environnement, pour que la
  // commande reste reproductible en test.
  const jour = process.env.RELEASE_DATE ?? new Date().toISOString().slice(0, 10);
  const memeJour = manifeste.releases.filter(
    (r) => r.id === jour || r.id.startsWith(`${jour}-`),
  ).length;
  return memeJour === 0 ? jour : `${jour}-${memeJour + 1}`;
}

/** L'index TypeScript : des imports statiques, seule forme qu'un bundle sait suivre. */
function ecrireIndex(manifeste) {
  const lignes = [
    "// Fichier généré par `npm run release:new`. Ne pas éditer à la main :",
    "// `npm run release:check` compare son contenu à l'archive et rougit sinon.",
    "//",
    "// Les imports sont statiques par nécessité : un bundle ne résout pas un",
    "// chemin calculé à l'exécution. Chaque release archivée est donc nommée ici.",
    "",
    'import type { ConstitutionData } from "@/lib/constitution";',
    "",
  ];
  const nom = (id, locale) =>
    `r_${id.replace(/[^0-9A-Za-z]/g, "_")}_${locale}`;
  for (const r of manifeste.releases)
    for (const locale of LOCALES)
      lignes.push(
        `import ${nom(r.id, locale)} from "@/data/releases/${r.id}/constitution.${locale}.json";`,
      );
  lignes.push("");
  lignes.push("export interface ArchivedRelease {");
  lignes.push("  id: string;");
  lignes.push("  /** Empreinte du fichier archivé, par langue. */");
  lignes.push("  sha256: Record<string, string>;");
  lignes.push("  data: Record<string, ConstitutionData>;");
  lignes.push("}");
  lignes.push("");
  lignes.push("/** Les releases du fond, de la plus ancienne à la plus récente. */");
  lignes.push("export const ARCHIVED_RELEASES: ArchivedRelease[] = [");
  for (const r of manifeste.releases) {
    lignes.push("  {");
    lignes.push(`    id: ${JSON.stringify(r.id)},`);
    lignes.push(`    sha256: ${JSON.stringify(r.sha256)},`);
    lignes.push("    data: {");
    for (const locale of LOCALES)
      lignes.push(
        `      ${locale}: ${nom(r.id, locale)} as unknown as ConstitutionData,`,
      );
    lignes.push("    },");
    lignes.push("  },");
  }
  lignes.push("];");
  lignes.push("");
  writeFileSync(INDEX, lignes.join("\n"));
}

function archiver(label) {
  const manifeste = lireManifeste();
  const precedente = derniere(manifeste);
  const empreintes = Object.fromEntries(
    LOCALES.map((l) => [l, empreinte(fondCourant(l))]),
  );

  if (
    precedente &&
    LOCALES.every((l) => precedente.sha256[l] === empreintes[l])
  ) {
    console.log(
      `= le fond courant est déjà la release ${precedente.id} (rien à archiver).`,
    );
    return;
  }

  const id = identifiantDuJour(manifeste, label);
  const dossier = join(RELEASES, id);
  mkdirSync(dossier, { recursive: true });
  for (const locale of LOCALES)
    writeFileSync(
      join(dossier, `constitution.${locale}.json`),
      readFileSync(fondCourant(locale)),
    );

  manifeste.releases.push({ id, sha256: empreintes });
  writeFileSync(MANIFEST, `${JSON.stringify(manifeste, null, 2)}\n`);
  ecrireIndex(manifeste);
  console.log(`+ release ${id} archivée (${LOCALES.join(", ")}).`);
}

function verifier() {
  const manifeste = lireManifeste();
  const problemes = [];

  if (manifeste.releases.length === 0)
    problemes.push("aucune release archivée : lance `npm run release:new`.");

  // 1. Chaque archive est intacte.
  for (const r of manifeste.releases) {
    for (const locale of LOCALES) {
      const chemin = join(RELEASES, r.id, `constitution.${locale}.json`);
      if (!existsSync(chemin)) {
        problemes.push(`release ${r.id} : ${locale} manquante à l'archive.`);
        continue;
      }
      const vue = empreinte(chemin);
      if (vue !== r.sha256[locale])
        problemes.push(
          `release ${r.id} (${locale}) : l'archive a été modifiée. ` +
            "Une release est immuable : reviens sur cette édition, ou crée une nouvelle release.",
        );
    }
  }

  // 2. Aucune archive orpheline du manifeste.
  const connues = new Set(manifeste.releases.map((r) => r.id));
  for (const entree of existsSync(RELEASES) ? readdirSync(RELEASES) : []) {
    if (entree === "manifest.json" || entree === "index.ts") continue;
    if (!connues.has(entree))
      problemes.push(`${entree}/ est archivée mais absente du manifeste.`);
  }

  // 3. Le fond courant est la release la plus récente.
  const precedente = derniere(manifeste);
  if (precedente) {
    for (const locale of LOCALES) {
      const vue = empreinte(fondCourant(locale));
      if (vue !== precedente.sha256[locale])
        problemes.push(
          `src/data/constitution.${locale}.json a divergé de la release ${precedente.id}. ` +
            "Le fond servi doit toujours correspondre à une release archivée :\n" +
            "  npm run release:new",
        );
    }
  }

  // 4. L'index généré est à jour.
  if (existsSync(INDEX)) {
    const avant = readFileSync(INDEX, "utf8");
    ecrireIndex(manifeste);
    const apres = readFileSync(INDEX, "utf8");
    if (avant !== apres) {
      writeFileSync(INDEX, avant);
      problemes.push(
        "src/data/releases/index.ts n'est plus celui que le manifeste décrit :\n" +
          "  npm run release:new",
      );
    }
  } else if (manifeste.releases.length) {
    problemes.push("src/data/releases/index.ts manque : `npm run release:new`.");
  }

  if (problemes.length) {
    console.error(
      `Archive des releases en défaut :\n${problemes.map((p) => `  - ${p}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `Archive des releases conforme (${manifeste.releases.length} release(s), courante : ${derniere(manifeste).id}).`,
  );
}

try {
  const label = process.argv.includes("--label")
    ? process.argv[process.argv.indexOf("--label") + 1]
    : undefined;
  if (process.argv.includes("--check")) verifier();
  else if (process.argv.includes("--new")) archiver(label);
  else fail("Usage : node scripts/releases.mjs --new [--label <id>] | --check");
} catch (error) {
  if (error instanceof ReleaseError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
