// @vitest-environment jsdom
//
// Le geste retenu le temps d'une connexion : repris une fois, par qui sait
// l'accomplir, et jamais après que la personne est passée à autre chose.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  oublierIntention,
  reprendreIntention,
  reprendreVue,
  retenirIntention,
} from "./intention";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/composer");
});
afterEach(() => vi.useRealTimers());

describe("le geste retenu", () => {
  it("est rendu à qui le reconnaît, une seule fois", () => {
    retenirIntention("pdf");
    expect(reprendreIntention((g) => g === "pdf")).toBe("pdf");
    expect(reprendreIntention((g) => g === "pdf")).toBeNull();
  });

  it("reste en place pour un autre quand l'appelant ne le reconnaît pas", () => {
    retenirIntention("pdf-principes");
    expect(reprendreIntention((g) => g === "pdf")).toBeNull();
    expect(reprendreIntention((g) => g === "pdf-principes")).toBe("pdf-principes");
  });

  it("s'efface de lui-même au bout d'une demi-heure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T10:00:00Z"));
    retenirIntention("pdf");
    vi.setSystemTime(new Date("2026-10-04T10:31:00Z"));
    expect(reprendreIntention(() => true)).toBeNull();
    expect(localStorage.getItem("cc_intention")).toBeNull();
  });

  it("s'oublie à la demande", () => {
    retenirIntention("save");
    oublierIntention();
    expect(reprendreIntention(() => true)).toBeNull();
  });

  it("une valeur illisible ne casse rien", () => {
    localStorage.setItem("cc_intention", "{pas du json");
    expect(reprendreIntention(() => true)).toBeNull();
    expect(reprendreVue()).toBeNull();
  });
});

describe("l'onglet d'où la connexion est partie", () => {
  it("est retenu avec le geste, et rendu une seule fois", () => {
    window.history.replaceState(null, "", "/composer?vue=principes");
    retenirIntention("pdf-principes");
    expect(reprendreVue()).toBe("principes");
    // L'onglet ne se rejoue pas ; le geste, lui, attend toujours son preneur.
    expect(reprendreVue()).toBeNull();
    expect(reprendreIntention((g) => g === "pdf-principes")).toBe("pdf-principes");
  });

  it("n'est pas retenu quand l'URL n'en désigne aucun", () => {
    retenirIntention("pdf");
    expect(reprendreVue()).toBeNull();
  });

  it("ne garde rien du document : seulement un nom de geste et un onglet", () => {
    window.history.replaceState(null, "", "/composer?vue=appstore");
    retenirIntention("activer:focus");
    const garde = JSON.parse(localStorage.getItem("cc_intention")!);
    expect(Object.keys(garde).sort()).toEqual(["geste", "quand", "vue"]);
  });
});
