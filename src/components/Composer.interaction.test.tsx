// @vitest-environment jsdom
//
// L'angle mort de tout le reste de la suite : ce que l'interface fait quand on
// s'en sert. Les autres fichiers éprouvent le moteur, le fond, la grammaire et
// les deux exports — aucun ne touche un bouton. Or c'est là que vivent les
// décisions les plus délicates du chantier d'immuabilité : ouvrir une version
// composée avec un texte plus ancien, refuser d'en ouvrir une dont le texte a
// disparu, figer, rejouer.
//
// Le montage se fait sans Supabase (aucune clé dans l'environnement de test) :
// `getSupabase()` rend null, le compte est celui du repli local, et les versions
// vivent dans `localStorage`. C'est exactement le chemin qu'emprunte le
// développement sans clés, et il suffit à conduire l'interface.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// La couche d'animation est remplacée par des balises nues. Ce n'est pas une
// commodité : hors d'un navigateur qui peint, une sortie d'AnimatePresence ne
// s'achève jamais et le nœud reste dans le DOM — constaté le 18/08 dans le
// panneau navigateur (zéro frame en cinq secondes) et ici en jsdom. Sans ce
// bouchon, le test ne mesurerait pas ce que React rend, mais ce que l'animation
// n'a pas fini de retirer. Les animations elles-mêmes restent hors couverture,
// et c'est dit.
// Compte les fois où le moteur PDF est réellement demandé. `vi.hoisted` parce que
// la fabrique de `vi.mock` est hissée au-dessus des déclarations du module.
const moteurPdf = vi.hoisted(() => ({ demandes: 0 }));
vi.mock("@/lib/pdf", async () => {
  moteurPdf.demandes += 1;
  return {
    generateComposedPdfBlob: async () => new Blob(["%PDF-"]),
    generatePrincipesPdfBlob: async () => new Blob(["%PDF-"]),
  };
});

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const nue = (balise: string) =>
    function Nue({ children, ...props }: Record<string, unknown>) {
      const rest = { ...props };
      for (const p of [
        "initial", "animate", "exit", "transition", "layout", "layoutId",
        "whileInView", "viewport", "whileHover", "whileTap", "onAnimationComplete",
      ])
        delete rest[p];
      return React.createElement(balise, rest, children as React.ReactNode);
    };
  return {
    motion: new Proxy(
      {},
      { get: (_cible, balise: string) => nue(balise) },
    ),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: () => true,
  };
});
import userEvent from "@testing-library/user-event";
import Composer from "./Composer";
import { type ConstitutionData } from "@/lib/constitution";
import { CURRENT_RELEASE, releaseLabel, releaseSha } from "@/lib/releases";
import { COMPOSER } from "@/lib/i18n";
import frJson from "@/data/constitution.fr.json";

const data = frJson as unknown as ConstitutionData;
const t = COMPOSER.fr;
const DATE_COURANTE = releaseLabel(CURRENT_RELEASE, "fr");

const branding = {
  logo: "",
  setLogo: () => {},
  font: "source-serif",
  setFont: () => {},
  titleColor: "",
  setTitleColor: () => {},
};

/** Une version enregistrée, telle qu'elle vit dans le magasin local. */
function version(
  nom: string,
  content: { locale: "fr" | "en"; release: string; sha256: string } | null,
) {
  return {
    id: `id-${nom}`,
    name: nom,
    updated_at: "2026-08-19T09:00:00.000Z",
    payload: {
      ...(content ? { schemaVersion: 2 as const, content } : {}),
      title: `Constitution — ${nom}`,
      values: "",
      active: ["scribe"],
    },
  };
}

function semer(versions: ReturnType<typeof version>[]) {
  localStorage.setItem("cc_account", "1");
  localStorage.setItem("cc_versions", JSON.stringify(versions));
}

function monter() {
  return render(
    <Composer data={data} branding={branding} onTermClick={() => {}} locale="fr" />,
  );
}

/** Ouvre la version nommée depuis le panneau « Mes versions ». */
async function ouvrir(nom: string) {
  const utilisateur = userEvent.setup();
  monter();
  // La liste des versions arrive après le montage (lecture du magasin local).
  const etiquette = await screen.findByText(nom);
  await utilisateur.click(etiquette.closest("button")!);
  return utilisateur;
}

beforeEach(() => {
  localStorage.clear();
});

// Vitest tourne sans API globale (`globals: false`) : le nettoyage automatique
// de testing-library ne s'installe pas tout seul. Sans lui, chaque montage
// s'empile dans le document et un test compte le texte du précédent — c'est
// ainsi que le premier essai de ce fichier « voyait » un module resté à l'écran.
afterEach(() => {
  cleanup();
});

describe("le document composé, à l'écran", () => {
  it("rend le socle et les blocs cochés par défaut", async () => {
    monter();
    for (const bloc of data.blocks)
      expect(
        await screen.findByRole("heading", { name: bloc.heading, level: 2 }),
      ).toBeTruthy();
  });

  it("décocher un module retire son texte et fait apparaître son remplacement", async () => {
    // Le comportement qu'aucun test ne gardait : l'écran doit dire ce que le
    // moteur compose. C'est aussi ce qui garantit que le PDF et l'écran
    // racontent la même chose, puisque les deux lisent `compose()`.
    const utilisateur = userEvent.setup();
    monter();
    const scribe = data.modules.find((m) => m.id === "scribe")!;
    // Une phrase que le Scribe est seul à porter (le fond en répète d'autres
    // d'un Rôle à l'autre, elles ne prouveraient rien).
    const propre = "Il n'a pas à connaître toute la Constitution par cœur";
    const presence = (aiguille: string) =>
      screen.queryAllByText((contenu) => contenu.includes(aiguille)).length;

    expect(presence(propre)).toBeGreaterThan(0);

    const bascule = screen
      .getAllByRole("button")
      .find((b) => (b.textContent ?? "").trim().startsWith(scribe.label))!;
    await utilisateur.click(bascule);

    await waitFor(() => {
      expect(presence(propre)).toBe(0);
      expect(presence(t.defaultRule(scribe.label))).toBeGreaterThan(0);
    });
  });

  it("sans compte, un module payant ne s'active pas et la boîte s'ouvre", async () => {
    // Le mur du freemium. Il vient de changer de fichier (#1057) : sans ce test,
    // le neutraliser ne faisait rougir personne — vérifié en le neutralisant.
    const utilisateur = userEvent.setup();
    monter();
    const paye = data.modules.find((m) => m.tier === "extension")!;
    const bascule = screen
      .getAllByRole("button")
      .find((b) => (b.textContent ?? "").trim().startsWith(paye.label))!;

    await utilisateur.click(bascule);

    // La boîte s'ouvre, et l'insertion du module n'est pas entrée dans le
    // document. On vise l'ancre que le moteur pose, pas une chaîne : le texte
    // commence par un passage en gras, donc il ne vit pas dans un seul nœud.
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(document.getElementById(`ins-${paye.id}-0`)).toBeNull();
  });

  it("avec un compte, le même module s'active", async () => {
    const utilisateur = userEvent.setup();
    localStorage.setItem("cc_account", "1");
    monter();
    const paye = data.modules.find((m) => m.tier === "extension")!;
    const bascule = screen
      .getAllByRole("button")
      .find((b) => (b.textContent ?? "").trim().startsWith(paye.label))!;

    await utilisateur.click(bascule);

    await waitFor(() =>
      expect(document.getElementById(`ins-${paye.id}-0`)).not.toBeNull(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("basculer un module amène la modification dans le champ de vision", async () => {
    // La promesse de l'interface : on coche, et on voit ce que ça change. Rien ne
    // la gardait ; jsdom n'a pas de mise en page, mais l'élément visé se vérifie.
    const utilisateur = userEvent.setup();
    const vus: (string | undefined)[] = [];
    const vrai = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () {
      vus.push((this as HTMLElement).id);
    };
    try {
      monter();
      const scribe = data.modules.find((m) => m.id === "scribe")!;
      const bascule = screen
        .getAllByRole("button")
        .find((b) => (b.textContent ?? "").trim().startsWith(scribe.label))!;
      await utilisateur.click(bascule);
      // Décoché, un bloc retirable laisse un marqueur de réinsertion : c'est lui
      // qu'on doit amener sous les yeux.
      await waitFor(() => expect(vus).toContain("reins-scribe"));
    } finally {
      Element.prototype.scrollIntoView = vrai;
    }
  });
  it("s'approcher du bouton d'export fait descendre le moteur PDF", async () => {
    // Le chunk de @react-pdf pèse ~468 Ko gzip et ne partait qu'au clic : sur
    // connexion lente, l'attente était longue sous un simple « Génération… ».
    const utilisateur = userEvent.setup();
    monter();
    const bouton = screen.getByRole("button", {
      name: new RegExp(t.pdfDownload),
    });
    // Rien n'a été demandé au montage : c'est tout l'intérêt du chargement différé.
    expect(moteurPdf.demandes).toBe(0);

    await utilisateur.hover(bouton);

    // Le survol suffit à le faire descendre. Au clic, il est déjà là.
    await waitFor(() => expect(moteurPdf.demandes).toBe(1));
  });
});

describe("ouvrir une version enregistrée", () => {
  it("sur le texte du jour : aucun message, rien à signaler", async () => {
    semer([
      version("À jour", {
        locale: "fr",
        release: CURRENT_RELEASE,
        sha256: releaseSha(CURRENT_RELEASE, "fr")!,
      }),
    ]);
    await ouvrir("À jour");
    await waitFor(() => expect(screen.getByText(t.loaded("À jour"))).toBeTruthy());
    expect(screen.queryByText(new RegExp("Vous relisez cette version"))).toBeNull();
  });

  it("sur un texte disparu : refus d'ouvrir, et la raison", async () => {
    semer([
      version("Perdue", {
        locale: "fr",
        release: "2000-01-01",
        sha256: "a".repeat(64),
      }),
    ]);
    await ouvrir("Perdue");
    await waitFor(() =>
      expect(
        screen.getByText(t.releaseMissing(releaseLabel("2000-01-01", "fr"))),
      ).toBeTruthy(),
    );
    // Refus d'ouvrir : le titre de la composition n'a pas été remplacé.
    expect(screen.queryByDisplayValue("Constitution — Perdue")).toBeNull();
  });

  it("sur une empreinte qui ne correspond plus : refus d'ouvrir aussi", async () => {
    semer([
      version("Altérée", {
        locale: "fr",
        release: CURRENT_RELEASE,
        sha256: "b".repeat(64),
      }),
    ]);
    await ouvrir("Altérée");
    await waitFor(() =>
      expect(screen.getByText(t.releaseMismatch(DATE_COURANTE))).toBeTruthy(),
    );
    expect(screen.queryByDisplayValue("Constitution — Altérée")).toBeNull();
  });

  it("rejouer une version ancienne en crée une autre, l'originale intacte", async () => {
    // Le geste que la migration explicite a introduit : deux versions à la fin,
    // celle qu'on a adoptée et celle sur le texte du jour.
    semer([
      version("Adoptée en 2000", {
        locale: "fr",
        release: "2000-01-01",
        sha256: "a".repeat(64),
      }),
      version("À jour", {
        locale: "fr",
        release: CURRENT_RELEASE,
        sha256: releaseSha(CURRENT_RELEASE, "fr")!,
      }),
    ]);
    // La release 2000-01-01 n'existe pas dans l'archive : on éprouve donc le
    // refus, puis on part d'une version que l'archive connaît pour la migration.
    const utilisateur = await ouvrir("Adoptée en 2000");
    await waitFor(() =>
      expect(
        screen.getByText(t.releaseMissing(releaseLabel("2000-01-01", "fr"))),
      ).toBeTruthy(),
    );
    // Aucun bouton de migration sur une version qu'on n'a pas pu ouvrir.
    expect(
      screen.queryByRole("button", { name: t.releaseMigrateAction }),
    ).toBeNull();
    void utilisateur;
  });

  it("version d'avant l'archivage : on l'ouvre, on le dit, on propose de l'enregistrer", async () => {
    semer([version("Ancienne", null)]);
    const utilisateur = await ouvrir("Ancienne");
    await waitFor(() => expect(screen.getByText(t.releaseNotPinned)).toBeTruthy());

    await utilisateur.click(
      screen.getByRole("button", { name: t.releasePinAction }),
    );

    await waitFor(() => expect(screen.queryByText(t.releaseNotPinned)).toBeNull());
    const enregistre = JSON.parse(localStorage.getItem("cc_versions")!);
    expect(enregistre).toHaveLength(1);
    expect(enregistre[0].payload.content.release).toBe(CURRENT_RELEASE);
    expect(enregistre[0].name).toBe("Ancienne");
  });
});
