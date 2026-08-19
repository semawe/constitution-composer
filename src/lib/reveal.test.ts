import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou de la famille « échec silencieux » : aucun contenu ne part
 * invisible dans l'HTML prérendu.
 *
 * Framer Motion écrit l'état `initial` dans le balisage rendu côté serveur.
 * Une entrée animée déclenchée au défilement (`whileInView`) livrait donc un
 * `opacity:0` dans l'export statique : le titre de la page d'arrivée et les six
 * sections du corps constitutionnel n'apparaissaient qu'une fois React hydraté,
 * et jamais si le bundle échouait. Pire, `once: true` ne se déclenche que sur
 * une intersection réelle : un lien profond (`/composer#article-4`) sautait la
 * cible, qui restait à zéro — page blanche sur le texte qu'on venait lire.
 *
 * L'entrée animée vit désormais en CSS (`.cc-rise`, cf. `globals.css`) : elle
 * part de l'état visible dans le balisage, joue quand elle peut, et son échec
 * n'a aucune conséquence. Ce test interdit le retour du motif.
 */

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    // Les fichiers de test ne sont pas rendus : leurs mocks de Framer Motion
    // citent les noms de props sans les employer.
    return /\.tsx$/.test(path) && !/\.test\.tsx$/.test(path) ? [path] : [];
  });
}

const FILES = [...sources("src/components"), ...sources("src/app")];

describe("entrée animée", () => {
  it("ne cache aucun contenu derrière un déclenchement au défilement", () => {
    const coupables = FILES.filter((f) =>
      // Le commentaire qui explique la règle n'est pas une infraction.
      readFileSync(f, "utf8")
        .split("\n")
        .some((l) => /whileInView/.test(l) && !/^\s*(\/\/|\*)/.test(l)),
    );
    expect(coupables).toEqual([]);
  });

  // Le cas voisin — une animation d'opacité au montage — ne se lit pas
  // fiablement dans la source : rien ne distingue, à la lecture, un `animate`
  // qui part de l'invisible d'un `animate` légitime dans une `AnimatePresence`
  // montée sur action. Il se vérifie sur l'artefact : `npm run export:check`
  // (scripts/export-visible.mjs) refuse tout `opacity:0` dans les pages de
  // `out/`, et tourne en CI juste après le build.
});
