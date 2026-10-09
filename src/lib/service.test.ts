// Le port de service : la sortie forcée, et la seule porte vers Supabase.
//
// La sortie : si le service ne répond pas, la bibliothèque rend l'erreur et
// garde la session. Sur un poste partagé, la personne croirait être sortie
// sans l'être (audit du 04/10/2026, F06). L'adaptateur force alors la sortie
// locale, et ne lève jamais.
//
// La porte : le port n'a de sens que si rien ne le contourne. Un composant qui
// importerait de nouveau la bibliothèque Supabase échapperait au remplacement
// du backend (tâche ERP 3045, lot 4) et aux tests qui doublent le port.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Service } from "./service";
import { adaptateurSupabase } from "./supabase";
import { adaptateurHttp, CLE_SORTIE } from "./service-http";

/**
 * Ce que l'épreuve de sortie demande à un adaptateur : le monter connecté, avec
 * un service qui répond, refuse ou ne répond pas ; dire combien de demandes de
 * sortie sont parties ; dire si la sortie locale a été forcée.
 */
interface Banc {
  service: Service;
  demandesDeSortie(): number;
  sortieLocaleForcee(): boolean;
}
type Panne = "aucune" | "refus" | "injoignable" | "tout";

function bancSupabase(panne: Panne): Banc {
  const signOut = vi.fn(async (options?: { scope?: string }) => {
    if (panne === "tout") throw new Error("réseau");
    if (options) return { error: null };
    if (panne === "injoignable") throw new Error("réseau");
    if (panne === "refus") return { error: { message: "panne" } };
    return { error: null };
  });
  const sb = { auth: { signOut } } as unknown as SupabaseClient;
  return {
    service: adaptateurSupabase(sb),
    demandesDeSortie: () => signOut.mock.calls.filter((c) => c.length === 0).length,
    sortieLocaleForcee: () =>
      signOut.mock.calls.some((c) => (c[0] as { scope?: string } | undefined)?.scope === "local"),
  };
}

async function bancHttp(panne: Panne): Promise<Banc> {
  const memoire = new Map<string, string>();
  const stockage = {
    get length() {
      return memoire.size;
    },
    key: (i: number) => [...memoire.keys()][i] ?? null,
    getItem: (k: string) => memoire.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (panne === "tout") throw new Error("stockage plein");
      memoire.set(k, v);
    },
    removeItem: (k: string) => void memoire.delete(k),
    clear: () => memoire.clear(),
  } as Storage;
  let connecte = true;
  let sorties = 0;
  const fetch = vi.fn(async (entree: RequestInfo | URL) => {
    const chemin = String(entree);
    if (chemin === "/api/session/sortie") {
      sorties++;
      if (panne === "injoignable" || panne === "tout") throw new TypeError("réseau");
      if (panne === "refus") return new Response("{}", { status: 500 });
      connecte = false;
      return new Response("{}", { status: 200 });
    }
    const compte = connecte ? { id: "a", email: "a@exemple.test" } : null;
    return new Response(JSON.stringify({ compte }), { status: 200 });
  });
  const service = adaptateurHttp({
    fetch: fetch as unknown as typeof globalThis.fetch,
    stockage,
    origine: () => "https://composer.test",
  });
  await service.lireSession();
  let vu: unknown = "rien";
  service.ecouterSession((c) => (vu = c));
  return {
    service,
    demandesDeSortie: () => sorties,
    // La sortie locale, ici : l'écran tombe à personne, et la sortie reste
    // notée pour être rejouée au prochain contact.
    sortieLocaleForcee: () => vu === null && memoire.has(CLE_SORTIE),
  };
}

const adaptateurs: [string, (panne: Panne) => Banc | Promise<Banc>][] = [
  ["Supabase", bancSupabase],
  ["HTTP", bancHttp],
];

describe.each(adaptateurs)("la sortie, quand le service ne répond pas (%s)", (_nom, monter) => {
  it("un service injoignable : la sortie locale est forcée", async () => {
    const banc = await monter("injoignable");
    await expect(banc.service.sortir()).resolves.toBe(undefined);
    expect(banc.demandesDeSortie()).toBe(1);
    expect(banc.sortieLocaleForcee()).toBe(true);
  });

  it("un refus du service : la sortie locale est forcée aussi", async () => {
    const banc = await monter("refus");
    await banc.service.sortir();
    expect(banc.sortieLocaleForcee()).toBe(true);
  });

  it("même la sortie locale en échec ne fait pas lever la sortie", async () => {
    const banc = await monter("tout");
    await expect(banc.service.sortir()).resolves.toBeUndefined();
  });

  it("un service qui répond : une seule sortie, pas de forçage", async () => {
    const banc = await monter("aucune");
    await banc.service.sortir();
    expect(banc.demandesDeSortie()).toBe(1);
    expect(banc.sortieLocaleForcee()).toBe(false);
  });
});

describe("la seule porte vers Supabase", () => {
  const racine = join(__dirname, "..");
  const ADAPTATEUR = "lib/supabase.ts";

  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return fichiers(chemin);
      return /\.(ts|tsx|mjs|js)$/.test(nom) ? [chemin] : [];
    });
  }

  it("aucun fichier de l'application, hors l'adaptateur, n'importe la bibliothèque", () => {
    const fautifs = fichiers(racine)
      .map((f) => relative(racine, f))
      .filter((f) => f !== ADAPTATEUR && !/\.test\.tsx?$/.test(f))
      .filter((f) =>
        /from\s+["']@supabase\/|import\(\s*["']@supabase\/|require\(\s*["']@supabase\//.test(
          readFileSync(join(racine, f), "utf8"),
        ),
      );
    expect(fautifs).toEqual([]);
  });
});
