// Le backend choisi au build, et la marque que chaque page en porte (lue par
// la garde de déploiement, audit du 04/10/2026, F05).

import { describe, expect, it } from "vitest";
import { choisirBackend, exigerBackendEnProduction, marqueBackend } from "./backend";

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "cle-publique",
};

describe("le backend choisi au build", () => {
  it("serveur, sur demande explicite, même si des clés Supabase traînent", () => {
    const b = choisirBackend({ NEXT_PUBLIC_BACKEND: "serveur", ...SUPABASE });
    expect(b).toEqual({ type: "serveur" });
    expect(marqueBackend(b)).toBe("serveur");
  });

  it("Supabase par défaut quand ses clés sont là : la commande de build actuelle reste valable", () => {
    const b = choisirBackend(SUPABASE);
    expect(b.type).toBe("supabase");
    expect(marqueBackend(b)).toBe("supabase:abcdefghijklmnopqrst.supabase.co");
    expect(choisirBackend({ NEXT_PUBLIC_BACKEND: "supabase", ...SUPABASE }).type).toBe("supabase");
  });

  it("démonstration sans rien, ou sur demande", () => {
    expect(marqueBackend(choisirBackend({}))).toBe("demo");
    expect(marqueBackend(choisirBackend({ NEXT_PUBLIC_BACKEND: "demo", ...SUPABASE }))).toBe("demo");
    expect(choisirBackend({ NEXT_PUBLIC_SUPABASE_URL: "pas une url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "x" })).toEqual({
      type: "demo",
    });
  });

  it("un choix illisible, ou Supabase demandé sans clés, arrête le build", () => {
    expect(() => choisirBackend({ NEXT_PUBLIC_BACKEND: "api" })).toThrow(/NEXT_PUBLIC_BACKEND/);
    expect(() => choisirBackend({ NEXT_PUBLIC_BACKEND: "supabase" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("pas de production sans backend, sauf démonstration assumée", () => {
    const demo = choisirBackend({});
    expect(() => exigerBackendEnProduction(demo, { NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_BACKEND=serveur/);
    expect(() =>
      exigerBackendEnProduction(demo, { NODE_ENV: "production", NEXT_PUBLIC_ALLOW_DEMO_MODE: "true" }),
    ).not.toThrow();
    expect(() => exigerBackendEnProduction(demo, { NODE_ENV: "development" })).not.toThrow();
    expect(() =>
      exigerBackendEnProduction(choisirBackend({ NEXT_PUBLIC_BACKEND: "serveur" }), { NODE_ENV: "production" }),
    ).not.toThrow();
  });
});
