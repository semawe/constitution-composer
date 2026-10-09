// @vitest-environment jsdom
//
// La Déclaration et le compte : qui voit quoi, et ce qui survit à une panne.
//
// Trois constats de l'audit adverse du 04/10/2026, éprouvés ici avec un double
// du service — une session qu'on change à la main, une table en mémoire :
//
//   F06 — d'un compte à l'autre sans passer par la déconnexion, la Déclaration
//         du premier restait devant le second, et lui était proposée ;
//   F07 — l'écriture ne disait pas pour quel compte elle avait été préparée ;
//   F10 — le miroir local d'une Déclaration connectée était écrit, jamais relu :
//         après une sauvegarde en échec, recharger perdait les modifications.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Session = { user: { id: string } } | null;
type Ecouteur = (
  compte: { id: string } | null,
  evenement: "connexion" | "deconnexion" | "autre",
) => void;

// Le double du port de service (`@/lib/service`), et non plus de Supabase : les
// composants ne parlent qu'au port.
const faux = vi.hoisted(() => {
  const etat = {
    session: null as { user: { id: string } } | null,
    ecouteurs: [] as Ecouteur[],
    lignes: new Map<string, { payload: unknown; revision: number }>(),
    appels: [] as { sous: string | null; args: Record<string, unknown> }[],
    enPanne: false,
  };
  const compte = () =>
    etat.session
      ? {
          id: etat.session.user.id,
          email: null,
          nom: null,
          prenom: null,
          organisation: null,
        }
      : null;
  const service = {
    lireSession: async () => compte(),
    ecouterSession: (cb: Ecouteur) => {
      etat.ecouteurs.push(cb);
      return () => {};
    },
    lireDeclaration: async (uid: string) => etat.lignes.get(uid) ?? null,
    ecrireDeclaration: async (
      payload: unknown,
      revision: number,
      pour: string,
    ) => {
      const sous = etat.session?.user.id ?? null;
      etat.appels.push({ sous, args: { payload, revision, compte: pour } });
      if (etat.enPanne || !sous) return { statut: "erreur" as const };
      etat.lignes.set(sous, { payload, revision });
      return { statut: "ecrite" as const, revision };
    },
  };
  return { etat, service };
});
vi.mock("@/lib/service", () => ({
  getService: () => faux.service,
  serviceConfigure: true,
}));
vi.mock("@/lib/pdf", async () => ({
  generateComposedPdfBlob: async () => new Blob(["%PDF-"]),
  generatePrincipesPdfBlob: async () => new Blob(["%PDF-"]),
}));

import Principes from "./Principes";
import type { PrincipesData } from "@/lib/principes-data";
import { PRINCIPES_UI } from "@/lib/i18n";
import { currentContentRef } from "@/lib/releases";
import principes from "@/data/principes.fr.json";

const data = principes as unknown as PrincipesData;
const t = PRINCIPES_UI.fr;

/** Une Déclaration telle que le compte la porte. */
function declaration(raisonEtre: string) {
  return {
    schemaVersion: 2,
    content: currentContentRef("fr", "principes"),
    removed: [],
    custom: [],
    order: data.principles.map((p) => p.id),
    raisonEtre,
    devise: "",
    ratifiers: "",
    signatories: "",
  };
}

function monter() {
  return render(
    <Principes
      data={data}
      logo=""
      font="source-serif"
      titleColor=""
      onTermClick={() => {}}
      locale="fr"
    />,
  );
}

/** La session change dans le navigateur, sans que la page soit rechargée. */
function passerA(
  uid: string | null,
  evenement: "connexion" | "deconnexion" = uid ? "connexion" : "deconnexion",
) {
  const session: Session = uid ? { user: { id: uid } } : null;
  faux.etat.session = session;
  act(() => {
    for (const ecouteur of faux.etat.ecouteurs)
      ecouteur(uid ? { id: uid } : null, evenement);
  });
}

const raison = () =>
  screen.getByPlaceholderText(t.purposePlaceholder) as HTMLTextAreaElement;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Le délai de l'autosauvegarde, plus de quoi laisser l'écriture revenir. */
const APRES_SAUVEGARDE = 1800;

beforeEach(() => {
  localStorage.clear();
  faux.etat.session = null;
  faux.etat.ecouteurs = [];
  faux.etat.lignes = new Map();
  faux.etat.appels = [];
  faux.etat.enPanne = false;
});
afterEach(() => cleanup());

describe("d'un compte à l'autre, sans déconnexion entre les deux", () => {
  it("la Déclaration du premier ne reste pas devant le second, et ne lui est pas proposée", async () => {
    faux.etat.session = { user: { id: "compte-a" } };
    faux.etat.lignes.set("compte-a", {
      payload: declaration("Raison d'être du compte A"),
      revision: 3,
    });
    monter();
    await waitFor(() => expect(raison().value).toBe("Raison d'être du compte A"));

    // Un autre compte prend la session (second onglet, lien de connexion) : il
    // n'y a pas d'événement de déconnexion entre les deux.
    passerA("compte-b");

    await waitFor(() => expect(raison().value).toBe(""));
    // Compte sans Déclaration face à un écran vidé : rien à rattacher.
    await pause(50);
    expect(screen.queryByText(t.attachTitle)).toBeNull();
    expect(screen.queryByDisplayValue("Raison d'être du compte A")).toBeNull();
  });

  it("un principe en cours d'ajout part avec le compte qui le tapait", async () => {
    const utilisateur = userEvent.setup();
    faux.etat.session = { user: { id: "compte-a" } };
    monter();
    await utilisateur.click(
      await screen.findByRole("button", { name: new RegExp(t.addPrinciple) }),
    );
    await utilisateur.type(
      screen.getByPlaceholderText(t.titlePlaceholder),
      "Principe privé de A",
    );

    passerA(null);

    await waitFor(() =>
      expect(screen.queryByDisplayValue("Principe privé de A")).toBeNull(),
    );
    // Le formulaire est refermé : le rouvrir ne rend pas la saisie.
    await utilisateur.click(
      screen.getByRole("button", { name: new RegExp(t.addPrinciple) }),
    );
    expect(
      (screen.getByPlaceholderText(t.titlePlaceholder) as HTMLInputElement).value,
    ).toBe("");
  });
});

describe("l'écriture dans le compte", () => {
  it("dit pour quel compte la charge a été préparée", async () => {
    const utilisateur = userEvent.setup();
    faux.etat.session = { user: { id: "compte-a" } };
    monter();
    await waitFor(() => expect(raison()).toBeEnabled());
    await pause(30);

    await utilisateur.type(raison(), "Servir");
    await waitFor(() => expect(faux.etat.appels.length).toBeGreaterThan(0), {
      timeout: 3000,
    });

    const dernier = faux.etat.appels.at(-1)!;
    expect(dernier.sous).toBe("compte-a");
    expect(dernier.args.compte).toBe("compte-a");
  });

  it("une charge en attente ne part pas sous la session du compte suivant", async () => {
    const utilisateur = userEvent.setup();
    faux.etat.session = { user: { id: "compte-a" } };
    monter();
    await waitFor(() => expect(raison()).toBeEnabled());
    await pause(30);
    await utilisateur.type(raison(), "Texte de A, pas encore enregistré");

    // B arrive avant que l'autosauvegarde de A ne soit partie.
    passerA("compte-b");
    await pause(APRES_SAUVEGARDE);

    for (const appel of faux.etat.appels) {
      const charge = appel.args.payload as { raisonEtre: string };
      expect(
        appel.sous === "compte-b" && charge.raisonEtre.includes("Texte de A"),
      ).toBe(false);
    }
    expect(faux.etat.lignes.get("compte-b")).toBeUndefined();
  });
});

describe("après une sauvegarde en échec", () => {
  /** A modifie sa Déclaration pendant une panne, puis la page est rechargée. */
  async function modifierPendantLaPanne() {
    const utilisateur = userEvent.setup();
    faux.etat.session = { user: { id: "compte-a" } };
    faux.etat.lignes.set("compte-a", {
      payload: declaration("Version du compte"),
      revision: 3,
    });
    faux.etat.enPanne = true;
    monter();
    await waitFor(() => expect(raison().value).toBe("Version du compte"));
    await pause(30);
    await utilisateur.clear(raison());
    await utilisateur.type(raison(), "Modification restée locale");
    await waitFor(() => expect(screen.getByText(t.saveFailed)).toBeTruthy(), {
      timeout: 3000,
    });
    // Rechargement : la page repart de zéro, le navigateur garde son miroir.
    cleanup();
    faux.etat.ecouteurs = [];
    faux.etat.enPanne = false;
    return utilisateur;
  }

  it("recharger propose de reprendre les modifications, et les rend", async () => {
    const utilisateur = await modifierPendantLaPanne();
    monter();

    // Le compte est affiché tel qu'il est, et la reprise est proposée.
    expect(await screen.findByText(t.recoverTitle)).toBeTruthy();
    expect(raison().value).toBe("Version du compte");
    // Le compte n'a pas bougé entre-temps : pas d'avertissement de conflit.
    expect(screen.queryByText(t.recoverNewer)).toBeNull();

    await utilisateur.click(screen.getByRole("button", { name: t.recoverLocal }));

    await waitFor(() => expect(raison().value).toBe("Modification restée locale"));
    expect(screen.queryByText(t.recoverTitle)).toBeNull();
    // Reprise, elle repart vers le compte.
    await waitFor(
      () =>
        expect(
          (faux.etat.lignes.get("compte-a")!.payload as { raisonEtre: string })
            .raisonEtre,
        ).toBe("Modification restée locale"),
      { timeout: 3000 },
    );
  });

  it("rien n'est écrit dans le compte tant que la personne n'a pas choisi", async () => {
    await modifierPendantLaPanne();
    faux.etat.appels = [];
    monter();
    expect(await screen.findByText(t.recoverTitle)).toBeTruthy();

    await pause(APRES_SAUVEGARDE);

    expect(faux.etat.appels).toEqual([]);
  });

  it("garder la version du compte écarte les modifications locales", async () => {
    const utilisateur = await modifierPendantLaPanne();
    monter();
    await screen.findByText(t.recoverTitle);

    await utilisateur.click(
      screen.getByRole("button", { name: t.recoverAccount }),
    );

    expect(screen.queryByText(t.recoverTitle)).toBeNull();
    expect(raison().value).toBe("Version du compte");
    // Et la proposition ne revient pas au rechargement suivant.
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("cc_principes:compte-a")!).aEcrire,
      ).toBe(false),
    );
  });

  it("si le compte a avancé ailleurs entre-temps, la reprise le dit avant d'écraser", async () => {
    await modifierPendantLaPanne();
    // Un autre appareil a enregistré pendant ce temps.
    faux.etat.lignes.set("compte-a", {
      payload: declaration("Version d'un autre appareil"),
      revision: 4,
    });
    monter();

    expect(await screen.findByText(t.recoverNewer)).toBeTruthy();
    expect(raison().value).toBe("Version d'un autre appareil");
  });

  it("un miroir à jour ne propose rien", async () => {
    const utilisateur = userEvent.setup();
    faux.etat.session = { user: { id: "compte-a" } };
    monter();
    await waitFor(() => expect(raison()).toBeEnabled());
    await pause(30);
    await utilisateur.type(raison(), "Enregistrée normalement");
    await waitFor(
      () => expect(faux.etat.lignes.get("compte-a")).toBeDefined(),
      { timeout: 3000 },
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("cc_principes:compte-a")!).aEcrire,
      ).toBe(false),
    );

    cleanup();
    faux.etat.ecouteurs = [];
    monter();

    await waitFor(() => expect(raison().value).toBe("Enregistrée normalement"));
    await pause(50);
    expect(screen.queryByText(t.recoverTitle)).toBeNull();
  });
});
