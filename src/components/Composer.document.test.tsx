// @vitest-environment jsdom
//
// Un document est un couple : un contenu, et le texte dont il est fait. Ce
// fichier éprouve les gestes qui pouvaient défaire ce couple sans le dire, tous
// relevés par l'audit adverse du 04/10/2026 sur le commit c081725 :
//
//   F01 — enregistrer une version relue sur un texte ancien la rattachait au
//         texte du jour ;
//   F02 — ouvrir une version laissait le brouillon d'avant recouvrir son titre,
//         ses valeurs et ses modules ;
//   F06 — la déconnexion laissait le document privé à l'écran et dans le
//         navigateur, pour la personne suivante.
//
// L'archive est la vraie : elle porte trois releases, dont deux anciennes. Le
// montage se fait sans Supabase, comme `Composer.interaction.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("@/lib/pdf", async () => ({
  generateComposedPdfBlob: async () => new Blob(["%PDF-"]),
  generatePrincipesPdfBlob: async () => new Blob(["%PDF-"]),
}));

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
    motion: new Proxy({}, { get: (_cible, balise: string) => nue(balise) }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: () => true,
  };
});

import Composer from "./Composer";
import { type ConstitutionData } from "@/lib/constitution";
import { ARCHIVED_RELEASES } from "@/data/releases";
import { CURRENT_RELEASE, releaseSha } from "@/lib/releases";
import { COMPOSER } from "@/lib/i18n";
import frJson from "@/data/constitution.fr.json";

const data = frJson as unknown as ConstitutionData;
const t = COMPOSER.fr;
const ANCIENNE = ARCHIVED_RELEASES[0].id;
const LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type Reference = { locale: "fr" | "en"; release: string; sha256: string };

function version(
  nom: string,
  content: Reference | null,
  plus: Record<string, unknown> = {},
) {
  return {
    id: `id-${nom}`,
    name: nom,
    updated_at: "2026-08-19T09:00:00.000Z",
    payload: {
      ...(content ? { schemaVersion: 2 as const, content } : {}),
      title: `Constitution — ${nom}`,
      values: `valeurs de ${nom}`,
      active: ["scribe"],
      ...plus,
    },
  };
}

const reference = (release: string, locale: "fr" | "en" = "fr"): Reference => ({
  locale,
  release,
  sha256: releaseSha(release, locale)!,
});

function semer(versions: ReturnType<typeof version>[]) {
  localStorage.setItem("cc_account", "1");
  localStorage.setItem("cc_versions", JSON.stringify(versions));
}

/** Le Composer avec une identité visuelle vivante, comme sous `App`. */
function Atelier() {
  const [logo, setLogo] = useState("");
  const [font, setFont] = useState("source-serif");
  const [titleColor, setTitleColor] = useState("");
  return (
    <>
      <output data-testid="logo">{logo}</output>
      <Composer
        data={data}
        branding={{ logo, setLogo, font, setFont, titleColor, setTitleColor }}
        onTermClick={() => {}}
        locale="fr"
      />
    </>
  );
}

const titre = () => screen.getByLabelText(t.titleAriaLabel) as HTMLInputElement;
const enregistrees = () =>
  JSON.parse(localStorage.getItem("cc_versions") ?? "[]") as ReturnType<
    typeof version
  >[];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ouvrir(nom: string) {
  const utilisateur = userEvent.setup();
  render(<Atelier />);
  const etiquette = await screen.findByText(nom);
  await utilisateur.click(etiquette.closest("button")!);
  await waitFor(() => expect(screen.getByText(t.loaded(nom))).toBeTruthy());
  return utilisateur;
}

async function enregistrer(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.click(screen.getByRole("button", { name: t.saveVersion }));
  await waitFor(() => expect(screen.getByText(t.saved)).toBeTruthy());
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("enregistrer garde le texte du document affiché", () => {
  it("une version relue sur un texte ancien s'enregistre sur ce texte-là", async () => {
    semer([version("Adoptée", reference(ANCIENNE))]);
    const utilisateur = await ouvrir("Adoptée");

    // On ne change que le titre, puis on enregistre : rien ne demande de passer
    // au texte du jour.
    await utilisateur.clear(titre());
    await utilisateur.type(titre(), "Constitution retitrée");
    await enregistrer(utilisateur);

    const creee = enregistrees().find((v) => v.id !== "id-Adoptée")!;
    expect(creee.payload.title).toBe("Constitution retitrée");
    expect(creee.payload.content).toEqual({
      ...reference(ANCIENNE),
      kind: "constitution",
    });
    // Le texte ancien n'est pas celui du jour : sinon l'épreuve ne prouve rien.
    expect(ANCIENNE).not.toBe(CURRENT_RELEASE);
    // Et l'originale n'a pas bougé.
    expect(enregistrees().find((v) => v.id === "id-Adoptée")!.payload.content).toEqual(
      reference(ANCIENNE),
    );
  });

  it("une composition anglaise ouverte depuis la route française reste anglaise", async () => {
    semer([version("English", reference(CURRENT_RELEASE, "en"))]);
    const utilisateur = await ouvrir("English");

    await enregistrer(utilisateur);

    const creee = enregistrees().find((v) => v.id !== "id-English")!;
    expect(creee.payload.content).toMatchObject({
      locale: "en",
      release: CURRENT_RELEASE,
      sha256: releaseSha(CURRENT_RELEASE, "en"),
    });
  });

  it("une version d'avant l'archivage s'enregistre sur le texte qu'on a sous les yeux", async () => {
    // Elle n'est rattachée à aucun texte et s'affiche, en le disant, sur celui
    // du jour : c'est ce texte que la nouvelle version retient. L'originale,
    // elle, reste telle qu'elle était — non figée, jusqu'à ce qu'on la fige.
    semer([version("Ancienne", null)]);
    const utilisateur = await ouvrir("Ancienne");
    expect(screen.getByText(t.releaseNotPinned)).toBeTruthy();

    await enregistrer(utilisateur);

    const creee = enregistrees().find((v) => v.id !== "id-Ancienne")!;
    expect(creee.payload.content).toMatchObject({
      locale: "fr",
      release: CURRENT_RELEASE,
    });
    expect(
      enregistrees().find((v) => v.id === "id-Ancienne")!.payload,
    ).not.toHaveProperty("content");
  });
});

describe("ouvrir une version passe avant le brouillon", () => {
  it("le brouillon d'avant ne recouvre pas la version qu'on vient d'ouvrir", async () => {
    localStorage.setItem(
      "cc_compose",
      JSON.stringify({
        active: [],
        title: "BROUILLON D'UNE AUTRE ORGANISATION",
        values: "valeurs du brouillon",
      }),
    );
    semer([version("Enregistrée", reference(ANCIENNE))]);
    const utilisateur = userEvent.setup();
    render(<Atelier />);
    // Le brouillon est d'abord restauré, comme à chaque arrivée sur la page.
    await waitFor(() =>
      expect(titre().value).toBe("BROUILLON D'UNE AUTRE ORGANISATION"),
    );

    const etiquette = await screen.findByText("Enregistrée");
    await utilisateur.click(etiquette.closest("button")!);

    await waitFor(() => expect(titre().value).toBe("Constitution — Enregistrée"));
    // Le fond a changé avec la version ; on laisse aux effets le temps de
    // rejouer, puisque c'est en rejouant que l'ancien code écrasait.
    await pause(80);
    expect(titre().value).toBe("Constitution — Enregistrée");
    expect(screen.getByDisplayValue("valeurs de Enregistrée")).toBeTruthy();
    expect(screen.queryByDisplayValue("valeurs du brouillon")).toBeNull();
  });

  it("le brouillon retient le texte du document, et le retrouve au rechargement", async () => {
    semer([version("Adoptée", reference(ANCIENNE))]);
    await ouvrir("Adoptée");
    // L'écriture du brouillon est différée de 400 ms.
    await waitFor(
      () =>
        expect(
          JSON.parse(localStorage.getItem("cc_compose") ?? "{}").content,
        ).toMatchObject({ release: ANCIENNE, locale: "fr" }),
      { timeout: 2000 },
    );

    cleanup();
    render(<Atelier />);

    // Rechargée, la page rend le même document sur le même texte, et le dit.
    await waitFor(() => expect(titre().value).toBe("Constitution — Adoptée"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: t.releaseRejoinAction }),
      ).toBeTruthy(),
    );
  });
});

describe("le document part avec le compte", () => {
  it("à la déconnexion : plus rien à l'écran, ni dans le navigateur", async () => {
    semer([version("Privée", reference(CURRENT_RELEASE), { logo: LOGO })]);
    const utilisateur = await ouvrir("Privée");
    expect(screen.getByTestId("logo").textContent).toBe(LOGO);
    await waitFor(
      () => expect(localStorage.getItem("cc_compose")).toContain("Privée"),
      { timeout: 2000 },
    );

    await utilisateur.click(screen.getByRole("button", { name: t.signOut }));

    await waitFor(() => expect(titre().value).toBe(data.meta.title));
    expect(screen.queryByDisplayValue("valeurs de Privée")).toBeNull();
    expect(screen.getByTestId("logo").textContent).toBe("");
    // La liste des versions du compte a quitté l'écran avec lui.
    expect(screen.queryByText("Privée")).toBeNull();
    expect(screen.queryByText(t.loaded("Privée"))).toBeNull();
    // Le brouillon est réécrit 400 ms plus tard : on attend ce délai, pour
    // vérifier que ce qui se réécrit n'est pas le document privé.
    await pause(500);
    expect(localStorage.getItem("cc_compose") ?? "").not.toContain("Privée");
  });

  it("un brouillon écrit sous un compte ne se restaure pas pour une personne non connectée", async () => {
    localStorage.setItem(
      "cc_compose",
      JSON.stringify({
        active: [],
        title: "Document du compte précédent",
        values: "saisie privée",
        proprietaire: "local",
      }),
    );
    render(<Atelier />);

    await pause(80);
    expect(titre().value).toBe(data.meta.title);
    expect(screen.queryByDisplayValue("saisie privée")).toBeNull();
    await pause(500);
    expect(localStorage.getItem("cc_compose") ?? "").not.toContain("saisie privée");
  });

  it("le même brouillon revient à son compte", async () => {
    localStorage.setItem("cc_account", "1");
    localStorage.setItem(
      "cc_compose",
      JSON.stringify({
        active: [],
        title: "Mon document en cours",
        values: "ma saisie",
        proprietaire: "local",
      }),
    );
    render(<Atelier />);

    await waitFor(() => expect(titre().value).toBe("Mon document en cours"));
  });

  it("le brouillon anonyme suit la personne à travers sa connexion", async () => {
    // C'est lui qui franchit l'aller-retour vers Google : se connecter ne doit
    // rien effacer de ce qu'on a composé avant.
    localStorage.setItem(
      "cc_compose",
      JSON.stringify({ active: [], title: "Composé avant de me connecter", values: "" }),
    );
    const utilisateur = userEvent.setup();
    render(<Atelier />);
    await waitFor(() =>
      expect(titre().value).toBe("Composé avant de me connecter"),
    );

    // Le mur s'ouvre sur l'enregistrement ; la connexion simulée le referme.
    await utilisateur.click(screen.getByRole("button", { name: t.saveVersion }));
    await utilisateur.click(
      await screen.findByRole("button", { name: t.continueGoogle }),
    );

    // Le geste demandé avant la connexion est repris : la version s'enregistre,
    // avec le document qu'on avait composé.
    await waitFor(() => expect(enregistrees()).toHaveLength(1));
    expect(enregistrees()[0].payload.title).toBe("Composé avant de me connecter");
    expect(titre().value).toBe("Composé avant de me connecter");
  });
});
