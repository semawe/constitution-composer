// La file d'écriture de la Déclaration de Principes, et son garde-fou de
// révision.
//
// Sérialiser les écritures côté client (une requête en vol au plus, la dernière
// valeur en attente) suffisait à un onglet. À deux onglets, ou à deux appareils,
// le dernier arrivé gagnait même s'il portait un état plus ancien : la fenêtre
// inactive finissait son cycle de sauvegarde et remettait en base ce qu'elle
// avait en mémoire. La révision ferme cette course en base (0009), et ce module
// en porte l'autre moitié : proposer la révision suivante, lire le verdict, et
// s'arrêter net quand il est négatif.
//
// S'arrêter est le point important. Réessayer après un refus, c'est proposer une
// révision plus haute et gagner la course au tour suivant — donc écraser
// justement ce qu'on vient d'apprendre. La file se bloque, et l'écran demande à
// la personne de recharger.

import type { DeclarationPayload } from "./declaration";

/** Ce que la base répond à une tentative d'écriture. */
export type Reponse =
  | { statut: "ecrite"; revision: number }
  /** Le compte porte un état au moins aussi récent : rien n'a été écrit. */
  | { statut: "perimee"; revision: number }
  | { statut: "erreur" };

/** L'écriture elle-même : l'appel à `save_declaration()`, ou son double. */
export type Ecrire = (
  payload: DeclarationPayload,
  revision: number,
) => Promise<Reponse>;

export type EtatSauvegarde =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  /** Refus de la base : l'état affiché est plus ancien que celui du compte. */
  | "perimee";

export interface FileDeclaration {
  /** Enfile une valeur. Une requête en vol au plus, la dernière valeur gagne. */
  enfiler(payload: DeclarationPayload): void;
  /** La révision que le compte porte, au dernier verdict connu. */
  revision(): number;
  /** true dès qu'un refus est tombé : la file n'écrira plus rien. */
  perimee(): boolean;
  /** Résolue quand la file est vide. Sert aux épreuves. */
  repos(): Promise<void>;
}

/**
 * Traduit le retour de `save_declaration()` en verdict.
 *
 * La RPC rend `{ecrite, revision}` : deux champs, parce qu'un refus peut rendre
 * la même révision que celle proposée (le garde-fou est strict) et serait alors
 * indistinguable d'un succès. `revision` peut arriver en chaîne — PostgREST
 * sérialise parfois un `bigint` ainsi.
 */
export function verdict(brut: unknown): Reponse {
  if (!brut || typeof brut !== "object") return { statut: "erreur" };
  const r = brut as Record<string, unknown>;
  const revision =
    typeof r.revision === "number"
      ? r.revision
      : typeof r.revision === "string"
        ? Number(r.revision)
        : Number.NaN;
  if (!Number.isFinite(revision)) return { statut: "erreur" };
  return r.ecrite === true
    ? { statut: "ecrite", revision }
    : { statut: "perimee", revision };
}

export function creerFileDeclaration({
  revision: revisionInitiale,
  ecrire,
  etat,
}: {
  /** La révision lue dans le compte. 0 si le compte n'a pas de Déclaration. */
  revision: number;
  ecrire: Ecrire;
  etat?: (e: EtatSauvegarde) => void;
}): FileDeclaration {
  let revision = revisionInitiale;
  let enAttente: DeclarationPayload | null = null;
  let enVol: Promise<void> | null = null;
  let perime = false;

  const vider = async () => {
    try {
      while (enAttente && !perime) {
        const courant = enAttente;
        enAttente = null;
        const r = await ecrire(courant, revision + 1);
        if (r.statut === "erreur") {
          // La valeur n'est pas perdue pour de bon : le payload dérive de
          // l'état, la frappe suivante la remet dans la file.
          etat?.("error");
          return;
        }
        revision = r.revision;
        if (r.statut === "perimee") {
          perime = true;
          etat?.("perimee");
          return;
        }
      }
      etat?.("saved");
    } catch {
      etat?.("error");
    }
  };

  return {
    enfiler(payload) {
      if (perime) return;
      enAttente = payload;
      if (enVol) return;
      etat?.("saving");
      enVol = vider().finally(() => {
        enVol = null;
      });
    },
    revision: () => revision,
    perimee: () => perime,
    async repos() {
      while (enVol) await enVol;
    },
  };
}
