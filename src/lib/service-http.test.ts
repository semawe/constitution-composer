// L'adaptateur HTTP du port de service, contre un double du service des
// comptes.
//
// Le double répond comme `serveur/src/application.ts` (mêmes routes, mêmes
// codes, chaque réponse liée à un compte porte son identifiant). La preuve
// contre le vrai service et un vrai PostgreSQL est dans
// `service-http.integration.test.ts`.

import { describe, expect, it, vi } from "vitest";
import {
  adaptateurHttp,
  CANAL_SESSION,
  CLE_COMPTE,
  CLE_SORTIE,
  cheminDeRetour,
  type Canal,
} from "./service-http";
import type { Compte, EvenementSession } from "./service";

const ORIGINE = "https://composer.test";
const A: Compte = { id: "a", email: "a@exemple.test", nom: "Ada", prenom: "Ada", organisation: "Orga A" };
const B: Compte = { id: "b", email: "b@exemple.test", nom: null, prenom: null, organisation: null };

/** Un stockage local en mémoire, partagé entre « onglets » quand on le veut. */
function stockage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

/** Un canal de diffusion entre onglets d'un même navigateur. */
function bus() {
  const abonnes = new Set<Canal>();
  return () => {
    const canal: Canal = {
      onmessage: null,
      postMessage(message) {
        for (const autre of abonnes)
          if (autre !== canal) queueMicrotask(() => autre.onmessage?.({ data: message }));
      },
    };
    abonnes.add(canal);
    return canal;
  };
}

interface Appel {
  methode: string;
  chemin: string;
  corps: Record<string, unknown> | undefined;
}

/**
 * Le service doublé. `session` est le compte que le cookie porte ; `panne`
 * rend le service injoignable (exception réseau) ou en erreur (500).
 */
function service() {
  const etat = {
    session: null as Compte | null,
    panne: null as null | "reseau" | "erreur",
    appels: [] as Appel[],
    /** Réponse imposée pour un chemin, le temps d'une épreuve. */
    imposer: new Map<string, () => Response>(),
  };
  const repondre = (statut: number, corps: unknown) =>
    new Response(JSON.stringify(corps), {
      status: statut,
      headers: { "content-type": "application/json" },
    });
  const fetch = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entree), ORIGINE);
    const methode = init?.method ?? "GET";
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    etat.appels.push({ methode, chemin: url.pathname + url.search, corps });
    if (etat.panne === "reseau") throw new TypeError("Failed to fetch");
    if (etat.panne === "erreur") return repondre(500, { erreur: "INTERNE" });
    const impose = etat.imposer.get(url.pathname);
    if (impose) return impose();
    const s = etat.session;
    const ecriture = () => {
      if (!s) return repondre(401, { erreur: "AUTH" });
      if (corps?.compte !== s.id) return repondre(403, { erreur: "COMPTE" });
      return null;
    };
    switch (`${methode} ${url.pathname}`) {
      case "GET /api/session":
        return repondre(200, { compte: s });
      case "POST /api/session/sortie":
        etat.session = null;
        return repondre(200, { ok: true });
      case "POST /api/connexion/lien":
        return repondre(202, { ok: true });
      case "GET /api/versions":
        if (!s) return repondre(401, { erreur: "AUTH" });
        return repondre(200, { compte: s.id, versions: [{ id: "v1", name: "Une", payload: {}, updated_at: "" }] });
      case "POST /api/versions":
        return ecriture() ?? repondre(201, { compte: s!.id, version: { id: "v2", name: corps!.nom } });
      case "POST /api/declaration":
        return ecriture() ?? repondre(200, { compte: s!.id, ecrite: true, revision: corps!.revision });
      case "GET /api/declaration":
        if (!s) return repondre(401, { erreur: "AUTH" });
        if (url.searchParams.get("compte") !== s.id) return repondre(403, { erreur: "COMPTE" });
        return repondre(200, { compte: s.id, declaration: { payload: { x: 1 }, revision: 3 } });
      case "POST /api/profil":
        if (ecriture()) return ecriture()!;
        etat.session = { ...s!, organisation: String(corps!.organisation) };
        return repondre(200, { compte: etat.session });
      case "GET /api/propositions":
        if (!s) return repondre(401, { erreur: "AUTH" });
        return repondre(200, { compte: s.id, propositions: [] });
      default:
        if (/^\/api\/versions\/[^/]+\/(renommer|remplacer|supprimer)$/.test(url.pathname))
          return ecriture() ?? repondre(200, { compte: s!.id, ok: true });
        return repondre(404, { erreur: "INTROUVABLE" });
    }
  });
  return { etat, fetch };
}

function monter(
  srv = service(),
  options: { stockage?: Storage; canal?: () => Canal | null; document?: Document | null } = {},
) {
  const naviguer = vi.fn();
  const evenements: [string | null, EvenementSession][] = [];
  const port = adaptateurHttp({
    fetch: srv.fetch as unknown as typeof fetch,
    stockage: options.stockage ?? stockage(),
    canal: options.canal,
    document: options.document ?? null,
    naviguer,
    origine: () => ORIGINE,
  });
  port.ecouterSession((c, e) => evenements.push([c?.id ?? null, e]));
  return { port, srv, naviguer, evenements };
}

const attendre = () => new Promise((r) => setTimeout(r, 0));

describe("la session", () => {
  it("est lue au service, et une session neuve se dit « connexion » une seule fois", async () => {
    const memoire = stockage();
    const srv = service();
    srv.etat.session = A;
    const premier = monter(srv, { stockage: memoire });
    expect(await premier.port.lireSession()).toEqual(A);
    expect(premier.evenements).toEqual([["a", "connexion"]]);
    // Un rechargement, ou un autre onglet : le compte est déjà connu ici.
    const second = monter(srv, { stockage: memoire });
    await second.port.lireSession();
    expect(second.evenements).toEqual([["a", "autre"]]);
    expect(memoire.getItem(CLE_COMPTE)).toBe("a");
  });

  it("le service injoignable à la première lecture : personne, sans lever", async () => {
    const srv = service();
    srv.etat.panne = "reseau";
    const { port } = monter(srv);
    await expect(port.lireSession()).resolves.toBeNull();
  });

  it("une relecture en panne garde le compte connu", async () => {
    const srv = service();
    srv.etat.session = A;
    const { port, evenements } = monter(srv);
    await port.lireSession();
    srv.etat.panne = "reseau";
    await expect(port.lireSession()).resolves.toEqual(A);
    expect(evenements).toHaveLength(1);
  });

  it("seule la dernière lecture lancée conclut : une réponse ancienne ne recouvre pas la nouvelle", async () => {
    const srv = service();
    let lacher!: () => void;
    const retenue = new Promise<void>((r) => (lacher = r));
    let n = 0;
    const fetchOrigine = srv.fetch.getMockImplementation()!;
    srv.fetch.mockImplementation(async (entree, init) => {
      if (String(entree) === "/api/session" && n++ === 0) {
        await retenue;
        return new Response(JSON.stringify({ compte: A }), { status: 200 });
      }
      return fetchOrigine(entree, init);
    });
    srv.etat.session = B;
    const { port } = monter(srv);
    const ancienne = port.lireSession();
    expect(await port.lireSession()).toEqual(B);
    lacher();
    await ancienne;
    // L'écran reste sur B : la réponse A, partie la première, est arrivée trop tard.
    await expect(port.listerVersions()).resolves.toHaveLength(1);
    expect(srv.etat.appels.at(-1)?.chemin).toBe("/api/versions");
  });

  it("efface la session que Supabase avait laissée dans ce navigateur", () => {
    const memoire = stockage();
    memoire.setItem("sb-zzebhtyvbzfnfrjhqiia-auth-token", "{\"access_token\":\"x\"}");
    memoire.setItem("sb-zzebhtyvbzfnfrjhqiia-auth-token-code-verifier", "v");
    memoire.setItem("cc_compose", "brouillon");
    monter(service(), { stockage: memoire });
    expect(memoire.getItem("sb-zzebhtyvbzfnfrjhqiia-auth-token")).toBeNull();
    expect(memoire.getItem("sb-zzebhtyvbzfnfrjhqiia-auth-token-code-verifier")).toBeNull();
    expect(memoire.getItem("cc_compose")).toBe("brouillon");
  });
});

describe("la sortie, quand le service ne répond pas", () => {
  async function connecte(panne: null | "reseau" | "erreur") {
    const memoire = stockage();
    const srv = service();
    srv.etat.session = A;
    const monte = monter(srv, { stockage: memoire });
    await monte.port.lireSession();
    srv.etat.panne = panne;
    return { ...monte, memoire };
  }

  it("service injoignable : l'écran sort tout de suite, et la sortie reste à rejouer", async () => {
    const { port, evenements, memoire, srv } = await connecte("reseau");
    await expect(port.sortir()).resolves.toBeUndefined();
    expect(evenements.at(-1)).toEqual([null, "deconnexion"]);
    expect(memoire.getItem(CLE_SORTIE)).not.toBeNull();
    // Le cookie porte toujours A ; tant que la sortie n'est pas passée, rien ne se lit.
    await expect(port.lireSession()).resolves.toBeNull();
    expect(srv.etat.appels.filter((a) => a.chemin === "/api/session")).toHaveLength(1);
  });

  it("refus du service : même issue", async () => {
    const { port, evenements, memoire } = await connecte("erreur");
    await port.sortir();
    expect(evenements.at(-1)).toEqual([null, "deconnexion"]);
    expect(memoire.getItem(CLE_SORTIE)).not.toBeNull();
  });

  it("au retour du service, la sortie passe avant toute lecture", async () => {
    const { port, memoire, srv } = await connecte("reseau");
    await port.sortir();
    srv.etat.panne = null;
    srv.etat.appels.length = 0;
    await expect(port.lireSession()).resolves.toBeNull();
    expect(srv.etat.appels.map((a) => `${a.methode} ${a.chemin}`)).toEqual([
      "POST /api/session/sortie",
      "GET /api/session",
    ]);
    expect(memoire.getItem(CLE_SORTIE)).toBeNull();
    expect(srv.etat.session).toBeNull();
  });

  it("une connexion ne part pas tant que la sortie n'est pas passée", async () => {
    const { port, naviguer, srv } = await connecte("reseau");
    await port.sortir();
    await expect(port.partirChezGoogle(`${ORIGINE}/composer`)).resolves.toEqual({ ok: false });
    await expect(port.demanderLien("a@exemple.test", `${ORIGINE}/composer`)).resolves.toEqual({ ok: false });
    expect(naviguer).not.toHaveBeenCalled();
    srv.etat.panne = null;
    await expect(port.partirChezGoogle(`${ORIGINE}/composer`)).resolves.toEqual({ ok: true });
    expect(srv.etat.session).toBeNull();
  });

  it("un service qui répond : une seule demande, rien à rejouer", async () => {
    const { port, memoire, srv } = await connecte(null);
    srv.etat.appels.length = 0;
    await port.sortir();
    expect(srv.etat.appels.map((a) => a.chemin)).toEqual(["/api/session/sortie"]);
    expect(memoire.getItem(CLE_SORTIE)).toBeNull();
  });
});

describe("les onglets", () => {
  it("une sortie dans un onglet fait sortir l'autre", async () => {
    const memoire = stockage();
    const canal = bus();
    const srv = service();
    srv.etat.session = A;
    const un = monter(srv, { stockage: memoire, canal });
    const deux = monter(srv, { stockage: memoire, canal });
    await un.port.lireSession();
    await deux.port.lireSession();
    await un.port.sortir();
    await attendre();
    await attendre();
    expect(deux.evenements.at(-1)).toEqual([null, "deconnexion"]);
  });

  it("un autre compte ouvert dans un onglet : l'autre onglet suit, sans repasser par personne", async () => {
    const memoire = stockage();
    const canal = bus();
    const srv = service();
    srv.etat.session = A;
    const un = monter(srv, { stockage: memoire, canal });
    const deux = monter(srv, { stockage: memoire, canal });
    await un.port.lireSession();
    await deux.port.lireSession();
    // Dans l'onglet un, retour de Google sur le compte B : sa page se recharge.
    srv.etat.session = B;
    const unRecharge = monter(srv, { stockage: memoire, canal });
    await unRecharge.port.lireSession();
    await attendre();
    await attendre();
    expect(deux.evenements.at(-1)).toEqual(["b", "autre"]);
  });

  it("au retour sur l'onglet, la session est relue", async () => {
    const srv = service();
    srv.etat.session = A;
    const doc = new EventTarget() as unknown as Document & { visibilityState: string };
    Object.defineProperty(doc, "visibilityState", { value: "visible", configurable: true });
    const { port, evenements } = monter(srv, { document: doc });
    await port.lireSession();
    srv.etat.session = B;
    doc.dispatchEvent(new Event("visibilitychange"));
    await attendre();
    await attendre();
    expect(evenements.at(-1)).toEqual(["b", "connexion"]);
  });

  it("le canal porte le nom attendu", () => {
    expect(CANAL_SESSION).toBe("cc-session");
  });
});

describe("les écritures et les réponses", () => {
  async function avecA() {
    const srv = service();
    srv.etat.session = A;
    const monte = monter(srv);
    await monte.port.lireSession();
    return monte;
  }

  it("chaque écriture dit pour quel compte elle a été préparée", async () => {
    const { port, srv } = await avecA();
    await port.creerVersion("Une", { title: "", values: "", active: [] });
    await port.renommerVersion("v1", "Deux");
    await port.supprimerVersion("v1");
    await port.enregistrerOrganisation("Orga");
    await port.ecrireDeclaration({} as never, 4, "a");
    const ecritures = srv.etat.appels.filter((a) => a.methode === "POST");
    expect(ecritures.map((a) => a.corps?.compte)).toEqual(["a", "a", "a", "a", "a"]);
    expect(ecritures.map((a) => a.chemin)).toEqual([
      "/api/versions",
      "/api/versions/v1/renommer",
      "/api/versions/v1/supprimer",
      "/api/profil",
      "/api/declaration",
    ]);
  });

  it("sans compte affiché, aucune écriture ne part", async () => {
    const { port, srv } = monter();
    await expect(port.creerVersion("x", { title: "", values: "", active: [] })).rejects.toThrow("AUTH");
    expect(srv.etat.appels).toHaveLength(0);
  });

  it("le service a changé de compte entre-temps : l'écriture est refusée et l'écran suit", async () => {
    const { port, srv, evenements } = await avecA();
    srv.etat.session = B;
    await expect(port.renommerVersion("v1", "x")).rejects.toThrow("COMPTE");
    await attendre();
    await attendre();
    expect(evenements.at(-1)).toEqual(["b", "connexion"]);
    await expect(port.ecrireDeclaration({} as never, 2, "a")).resolves.toEqual({ statut: "erreur" });
  });

  it("une réponse qui porte un autre compte que celui affiché est écartée", async () => {
    const { port, srv } = await avecA();
    srv.etat.imposer.set(
      "/api/versions",
      () => new Response(JSON.stringify({ compte: "b", versions: [{ id: "de-b" }] }), { status: 200 }),
    );
    await expect(port.listerVersions()).rejects.toThrow("COMPTE");
    srv.etat.imposer.set(
      "/api/declaration",
      () => new Response(JSON.stringify({ compte: "b", declaration: { payload: { de: "b" }, revision: 9 } }), { status: 200 }),
    );
    await expect(port.lireDeclaration("a")).rejects.toThrow("COMPTE");
  });

  it("une session échue fait tomber l'identité affichée", async () => {
    const { port, srv, evenements } = await avecA();
    srv.etat.session = null;
    await expect(port.listerVersions()).rejects.toThrow("AUTH");
    expect(evenements.at(-1)).toEqual([null, "deconnexion"]);
  });

  it("les refus du service gardent leur code (LIMIT, REFERENCE)", async () => {
    const { port, srv } = await avecA();
    for (const code of ["LIMIT", "REFERENCE"]) {
      srv.etat.imposer.set(
        "/api/versions",
        () => new Response(JSON.stringify({ erreur: code }), { status: code === "LIMIT" ? 409 : 422 }),
      );
      await expect(port.creerVersion("x", { title: "", values: "", active: [] })).rejects.toThrow(code);
    }
  });

  it("la Déclaration : lue pour le compte demandé, écrite avec le verdict du service", async () => {
    const { port, srv } = await avecA();
    await expect(port.lireDeclaration("a")).resolves.toEqual({ payload: { x: 1 }, revision: 3 });
    expect(srv.etat.appels.at(-1)?.chemin).toBe("/api/declaration?compte=a");
    await expect(port.ecrireDeclaration({} as never, 4, "a")).resolves.toEqual({ statut: "ecrite", revision: 4 });
    srv.etat.imposer.set(
      "/api/declaration",
      () => new Response(JSON.stringify({ compte: "a", ecrite: false, revision: 7 }), { status: 200 }),
    );
    await expect(port.ecrireDeclaration({} as never, 5, "a")).resolves.toEqual({ statut: "perimee", revision: 7 });
    srv.etat.panne = "reseau";
    await expect(port.ecrireDeclaration({} as never, 6, "a")).resolves.toEqual({ statut: "erreur" });
  });

  it("l'organisation enregistrée se lit aussitôt sur le compte affiché", async () => {
    const { port, evenements } = await avecA();
    await expect(port.enregistrerOrganisation("Nouvelle")).resolves.toEqual({ ok: true });
    expect(evenements.at(-1)).toEqual(["a", "autre"]);
    expect((await port.lireSession())?.organisation).toBe("Nouvelle");
  });
});

describe("la connexion", () => {
  it("Google : une navigation vers le service, avec la page de retour en chemin local", async () => {
    const { port, naviguer } = monter();
    await expect(port.partirChezGoogle(`${ORIGINE}/en/composer`)).resolves.toEqual({ ok: true });
    expect(naviguer).toHaveBeenCalledWith("/api/connexion/google?retour=%2Fen%2Fcomposer");
    await port.partirChezGoogle("https://ailleurs.test/piege");
    expect(naviguer).toHaveBeenLastCalledWith("/api/connexion/google?retour=%2Fcomposer");
  });

  it("lien : demandé avec le chemin de retour et la langue de la page", async () => {
    const { port, srv } = monter();
    await expect(port.demanderLien("a@exemple.test", `${ORIGINE}/en/composer`)).resolves.toEqual({ ok: true });
    expect(srv.etat.appels.at(-1)?.corps).toEqual({ email: "a@exemple.test", retour: "/en/composer", langue: "en" });
    srv.etat.imposer.set("/api/connexion/lien", () => new Response(JSON.stringify({ ok: false, erreur: "FREIN" }), { status: 429 }));
    await expect(port.demanderLien("a@exemple.test", `${ORIGINE}/composer`)).resolves.toEqual({ ok: false });
  });

  it("case des nouvelles cochée : elle part avec le lien comme avec Google, et seulement alors", async () => {
    const { port, srv, naviguer } = monter();
    await port.demanderLien("a@exemple.test", `${ORIGINE}/composer`, true);
    expect(srv.etat.appels.at(-1)?.corps).toEqual({
      email: "a@exemple.test",
      retour: "/composer",
      langue: "fr",
      infolettre: true,
    });
    await port.partirChezGoogle(`${ORIGINE}/composer`, true);
    expect(naviguer).toHaveBeenLastCalledWith("/api/connexion/google?retour=%2Fcomposer&infolettre=1");
  });

  it("le chemin de retour ne sort jamais de l'origine", () => {
    expect(cheminDeRetour(`${ORIGINE}/composer?vue=principes`, ORIGINE)).toBe("/composer");
    expect(cheminDeRetour("/lite", ORIGINE)).toBe("/lite");
    expect(cheminDeRetour("//ailleurs.test/x", ORIGINE)).toBe("/composer");
    expect(cheminDeRetour("javascript:alert(1)", ORIGINE)).toBe("/composer");
  });
});
