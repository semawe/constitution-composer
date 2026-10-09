// L'épreuve du garde-fou de révision, en négatif d'abord : deux onglets qui
// sauvegardent dans le désordre, et c'est l'écriture la plus ancienne qui doit
// être refusée — sans rien perdre de la plus récente.
//
// Le double de la base ci-dessous n'implémente qu'une chose, la clause qui porte
// tout dans 0009_revision_declarations.sql : `where d.revision < excluded.revision`.

import { describe, expect, it, vi } from "vitest";
import { creerFileDeclaration, verdict, type EtatSauvegarde } from "./declaration-sync";
import type { DeclarationPayload } from "./declaration";

/** Un payload reconnaissable, réduit à ce que l'épreuve regarde. */
function declaration(marque: string): DeclarationPayload {
  return {
    removed: [],
    custom: [],
    order: [],
    raisonEtre: marque,
    devise: "",
    ratifiers: "",
    signatories: "",
  };
}

/**
 * `public.save_declaration()`, en mémoire. Rend le même objet que la RPC, y
 * compris la révision en chaîne, comme PostgREST le fait pour un `bigint`.
 */
function base(revision = 0, payload: DeclarationPayload | null = null) {
  const etat = { revision, payload, appels: 0 };
  return {
    etat,
    /** Ce que fait un autre onglet, sans passer par notre file. */
    ecritureConcurrente(p: DeclarationPayload) {
      etat.revision += 1;
      etat.payload = p;
    },
    async rpc(p: DeclarationPayload, proposee: number) {
      etat.appels += 1;
      if (proposee > etat.revision) {
        etat.revision = proposee;
        etat.payload = p;
        return { ecrite: true, revision: String(etat.revision) };
      }
      return { ecrite: false, revision: String(etat.revision) };
    },
  };
}

/** Une file branchée sur ce double, verdict compris (le chemin réel). */
function file(serveur: ReturnType<typeof base>, etats: EtatSauvegarde[] = []) {
  return creerFileDeclaration({
    revision: serveur.etat.revision,
    ecrire: async (p, r) => verdict(await serveur.rpc(p, r)),
    etat: (e) => etats.push(e),
  });
}

describe("deux écritures dans le désordre", () => {
  it("refuse la plus ancienne sans perdre la plus récente", async () => {
    const serveur = base();
    const etats: EtatSauvegarde[] = [];
    // L'onglet A lit le compte à la révision 0, et garde cette lecture.
    const ongletA = file(serveur, etats);
    // Entretemps, l'onglet B écrit sa propre version : le compte passe à 1.
    serveur.ecritureConcurrente(declaration("onglet B"));

    // A arrive en retard et propose 1, qui n'est plus supérieure à 1.
    ongletA.enfiler(declaration("onglet A"));
    await ongletA.repos();

    expect(serveur.etat.payload?.raisonEtre).toBe("onglet B");
    expect(serveur.etat.revision).toBe(1);
    expect(etats).toEqual(["saving", "perimee"]);
    expect(ongletA.perimee()).toBe(true);
  });

  it("après un refus, la file n'écrit plus rien", async () => {
    const serveur = base();
    const f = file(serveur);
    serveur.ecritureConcurrente(declaration("onglet B"));
    f.enfiler(declaration("onglet A"));
    await f.repos();
    const appelsAuRefus = serveur.etat.appels;

    // Chaque frappe suivante repasserait par la file. Sans blocage, elle
    // proposerait une révision plus haute et gagnerait la course — donc
    // écraserait ce qu'elle vient tout juste d'apprendre.
    f.enfiler(declaration("onglet A, encore"));
    f.enfiler(declaration("onglet A, toujours"));
    await f.repos();

    expect(serveur.etat.appels).toBe(appelsAuRefus);
    expect(serveur.etat.payload?.raisonEtre).toBe("onglet B");
  });

  it("un refus ne se produit pas quand les écritures arrivent dans l'ordre", async () => {
    const serveur = base();
    const etats: EtatSauvegarde[] = [];
    const f = file(serveur, etats);

    f.enfiler(declaration("un"));
    await f.repos();
    f.enfiler(declaration("deux"));
    await f.repos();

    expect(serveur.etat.payload?.raisonEtre).toBe("deux");
    expect(serveur.etat.revision).toBe(2);
    expect(f.revision()).toBe(2);
    expect(etats).not.toContain("perimee");
  });
});

describe("la file elle-même", () => {
  it("garde une requête en vol au plus et n'écrit que la dernière valeur", async () => {
    const serveur = base();
    const f = file(serveur);

    f.enfiler(declaration("un"));
    f.enfiler(declaration("deux"));
    f.enfiler(declaration("trois"));
    await f.repos();

    // Trois frappes, deux appels : celui en vol, puis la dernière valeur.
    expect(serveur.etat.appels).toBe(2);
    expect(serveur.etat.payload?.raisonEtre).toBe("trois");
    expect(serveur.etat.revision).toBe(2);
  });

  it("une erreur laisse la révision où elle était, et se dit", async () => {
    const etats: EtatSauvegarde[] = [];
    const f = creerFileDeclaration({
      revision: 4,
      ecrire: async () => ({ statut: "erreur" }),
      etat: (e) => etats.push(e),
    });

    f.enfiler(declaration("un"));
    await f.repos();

    expect(f.revision()).toBe(4);
    expect(f.perimee()).toBe(false);
    expect(etats).toEqual(["saving", "error"]);
  });

  it("une écriture qui jette est une erreur, pas un plantage", async () => {
    const etats: EtatSauvegarde[] = [];
    const f = creerFileDeclaration({
      revision: 0,
      ecrire: () => Promise.reject(new Error("réseau")),
      etat: (e) => etats.push(e),
    });

    f.enfiler(declaration("un"));
    await expect(f.repos()).resolves.toBeUndefined();
    expect(etats).toEqual(["saving", "error"]);
  });

  it("reprend après une erreur : la frappe suivante réessaie", async () => {
    const serveur = base();
    let echoue = true;
    const f = creerFileDeclaration({
      revision: 0,
      ecrire: async (p, r) => {
        if (echoue) {
          echoue = false;
          return { statut: "erreur" };
        }
        return verdict(await serveur.rpc(p, r));
      },
    });

    f.enfiler(declaration("un"));
    await f.repos();
    f.enfiler(declaration("deux"));
    await f.repos();

    expect(serveur.etat.payload?.raisonEtre).toBe("deux");
    expect(f.revision()).toBe(1);
  });

  it("part de la révision lue dans le compte, pas de zéro", async () => {
    const serveur = base(7, declaration("déjà là"));
    const ecrire = vi.fn(async (p: DeclarationPayload, r: number) =>
      verdict(await serveur.rpc(p, r)),
    );
    const f = creerFileDeclaration({ revision: 7, ecrire });

    f.enfiler(declaration("suite"));
    await f.repos();

    expect(ecrire).toHaveBeenCalledWith(expect.anything(), 8);
    expect(serveur.etat.revision).toBe(8);
  });
});

describe("verdict()", () => {
  it("lit une révision en nombre comme en chaîne", () => {
    expect(verdict({ ecrite: true, revision: 3 })).toEqual({
      statut: "ecrite",
      revision: 3,
    });
    expect(verdict({ ecrite: true, revision: "3" })).toEqual({
      statut: "ecrite",
      revision: 3,
    });
  });

  it("ne prend pas un refus pour un succès quand la révision coïncide", () => {
    // Le cas qui interdit un simple entier nullable comme retour de la RPC :
    // proposer 2 contre une base à 2 est un refus, pas une écriture.
    expect(verdict({ ecrite: false, revision: 2 })).toEqual({
      statut: "perimee",
      revision: 2,
    });
  });

  it("traite un retour inintelligible comme une erreur, jamais comme un succès", () => {
    for (const brut of [null, undefined, 3, "ok", {}, { ecrite: true }, { revision: null }])
      expect(verdict(brut).statut).toBe("erreur");
  });
});

describe("une file arrêtée", () => {
  // Le défaut relevé par l'audit du 04/10/2026 (F07) : la file d'un compte,
  // remplacée sans être arrêtée, finissait sa boucle. Sa valeur en attente
  // partait après le changement de session — donc sous le jeton du compte
  // suivant, la RPC écrivant sous `auth.uid()`.
  it("n'écrit pas la valeur en attente, et ne dit plus rien", async () => {
    let lacher!: () => void;
    const porte = new Promise<void>((r) => (lacher = r));
    const ecrites: string[] = [];
    const etats: EtatSauvegarde[] = [];
    const ancienne = creerFileDeclaration({
      revision: 8,
      ecrire: async (p, r) => {
        ecrites.push(p.raisonEtre);
        // La première écriture reste en vol jusqu'à ce qu'on la lâche.
        if (ecrites.length === 1) await porte;
        return { statut: "ecrite", revision: r };
      },
      etat: (e) => etats.push(e),
    });

    ancienne.enfiler(declaration("A, première"));
    await Promise.resolve();
    ancienne.enfiler(declaration("A, en attente"));
    // Le compte change : la file de A est arrêtée, puis sa requête en vol revient.
    ancienne.arreter();
    const avant = [...etats];
    lacher();
    await ancienne.repos();

    // Seule la requête déjà partie a eu lieu : la charge en attente est jetée.
    expect(ecrites).toEqual(["A, première"]);
    // Et son verdict ne remonte pas à l'écran du compte suivant.
    expect(etats).toEqual(avant);
  });

  it("refuse toute nouvelle valeur", async () => {
    const ecrire = vi.fn(async (_p: DeclarationPayload, r: number) => ({
      statut: "ecrite" as const,
      revision: r,
    }));
    const f = creerFileDeclaration({ revision: 0, ecrire });
    f.arreter();
    f.enfiler(declaration("après l'arrêt"));
    await f.repos();
    expect(ecrire).not.toHaveBeenCalled();
  });
});
