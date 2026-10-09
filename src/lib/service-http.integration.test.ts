// L'adaptateur HTTP du site contre le vrai service des comptes et un vrai
// PostgreSQL : le parcours de l'épreuve à deux comptes (tâche ERP 3052), joué
// sans navigateur ni réseau.
//
// Le service est l'application de `serveur/`, appelée avec des Request
// standard, sur une base jetable (banc d'intégration du serveur). Google et
// Brevo y sont doublés. Un « navigateur » est ici un pot à cookies, un stockage
// local et un canal entre onglets partagés par ses onglets ; un « onglet » est
// une instance de l'adaptateur.
//
// Ce que cette épreuve ne couvre pas, et que seule la préproduction prouve : le
// vrai Google, le vrai Brevo, nginx et le pare-feu applicatif, un vrai
// navigateur (cookies HttpOnly, BroadcastChannel).
//
// Jouée seulement si COMPOSER_TEST_ADMIN_URL désigne un PostgreSQL local
// jetable (comme la suite du serveur) :
//   COMPOSER_TEST_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres \
//     npx vitest run src/lib/service-http.integration.test.ts

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adaptateurHttp, CLE_SORTIE, type Canal } from "./service-http";
import type { Compte, Service } from "./service";
import type { CompositionPayload } from "./compositions";
import type { DeclarationPayload } from "./declaration";

const ORIGINE = "https://composer.test";
const actif = !!process.env.COMPOSER_TEST_ADMIN_URL;

// Le banc vit dans serveur/, hors du périmètre de types du site : il est chargé
// par un chemin calculé, et décrit ici par ce qu'on en utilise.
interface Requete {
  (methode: string, chemin: string, options?: { json?: unknown; form?: Record<string, string> }): Promise<Response>;
}
interface NavigateurBanc {
  cookies: Map<string, string>;
  requete: Requete;
}
interface BancServeur {
  admin: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
  courriels: { a: string; texte: string }[];
  google: { prochainJeton: string | null };
  jetonGoogle(claims: Record<string, unknown>): Promise<string>;
  fin(): Promise<void>;
}
interface ModuleBanc {
  ouvrirBanc(): Promise<BancServeur>;
  Navigateur: new (banc: BancServeur) => NavigateurBanc;
  dernierJeton(banc: BancServeur, adresse: string): string;
  adresseNeuve(prefixe?: string): string;
  chargeValide(titre?: string): CompositionPayload;
}

let m: ModuleBanc;
let banc: BancServeur;

beforeAll(async () => {
  if (!actif) return;
  const chemin = ["..", "..", "serveur", "test", "integration", "banc.ts"].join("/");
  m = (await import(/* @vite-ignore */ chemin)) as ModuleBanc;
  banc = await m.ouvrirBanc();
});

afterAll(async () => {
  if (actif) await banc.fin();
});

/** Un navigateur : cookies, stockage local et canal partagés par ses onglets. */
function navigateur() {
  const nav = new m.Navigateur(banc);
  const memoire = new Map<string, string>();
  const stockage = {
    get length() {
      return memoire.size;
    },
    key: (i: number) => [...memoire.keys()][i] ?? null,
    getItem: (k: string) => memoire.get(k) ?? null,
    setItem: (k: string, v: string) => void memoire.set(k, String(v)),
    removeItem: (k: string) => void memoire.delete(k),
    clear: () => memoire.clear(),
  } as Storage;
  const abonnes = new Set<Canal>();
  const etat = { arrete: false, navigations: [] as string[] };

  /** Ce que fait `fetch` dans la page : même origine, cookies du navigateur. */
  const fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (etat.arrete) throw new TypeError("Failed to fetch");
    const corps = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    return nav.requete(init?.method ?? "GET", String(entree), { json: corps });
  };

  function onglet(): Service {
    return adaptateurHttp({
      fetch: fetch as typeof globalThis.fetch,
      stockage,
      origine: () => ORIGINE,
      naviguer: (url) => etat.navigations.push(url),
      canal: () => {
        const canal: Canal = {
          onmessage: null,
          postMessage(message) {
            for (const autre of abonnes)
              if (autre !== canal) queueMicrotask(() => autre.onmessage?.({ data: message }));
          },
        };
        abonnes.add(canal);
        return canal;
      },
    });
  }

  /** Lien reçu par courriel, ouvert puis confirmé d'un clic dans ce navigateur. */
  async function confirmerLien(adresse: string, jeton = m.dernierJeton(banc, adresse)) {
    return nav.requete("POST", "/api/connexion/lien/consommer", { form: { jeton, langue: "fr" } });
  }

  /** Départ chez Google (la navigation que l'onglet a demandée), puis retour. */
  async function allerRetourGoogle(sub: string, email: string) {
    const depart = await nav.requete("GET", etat.navigations.at(-1)!);
    const google = new URL(depart.headers.get("location")!);
    banc.google.prochainJeton = await banc.jetonGoogle({
      sub,
      email,
      nonce: google.searchParams.get("nonce"),
      name: "Personne Google",
    });
    return nav.requete(
      "GET",
      `/api/connexion/google/retour?code=code-test&state=${encodeURIComponent(google.searchParams.get("state")!)}&iss=${encodeURIComponent("https://accounts.google.com")}`,
    );
  }

  return { nav, stockage, etat, onglet, confirmerLien, allerRetourGoogle };
}

const suivre = (service: Service) => {
  const vus: (string | null)[] = [];
  service.ecouterSession((c) => vus.push(c?.id ?? null));
  return vus;
};
const laisserPasser = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

function declaration(texte: string): DeclarationPayload {
  return {
    schemaVersion: 2,
    removed: [],
    custom: [],
    order: [],
    raisonEtre: texte,
    devise: "",
    ratifiers: "",
    signatories: "",
  } as unknown as DeclarationPayload;
}

describe.skipIf(!actif)("l'adaptateur HTTP contre le vrai service", () => {
  it("connexion par lien, puis par Google, sur deux comptes : chacun revient sur sa page", async () => {
    const x = navigateur();
    const onglet = x.onglet();
    const adresseA = m.adresseNeuve("lien");
    expect(await onglet.demanderLien(adresseA, `${ORIGINE}/en/composer`)).toEqual({ ok: true });
    const confirme = await x.confirmerLien(adresseA);
    expect(confirme.status).toBe(303);
    expect(confirme.headers.get("location")).toBe("/en/composer");
    const a = (await x.onglet().lireSession()) as Compte;
    expect(a.email).toBe(adresseA);

    const y = navigateur();
    const ongletY = y.onglet();
    expect(await ongletY.partirChezGoogle(`${ORIGINE}/composer`)).toEqual({ ok: true });
    const retour = await y.allerRetourGoogle("g-epreuve", m.adresseNeuve("google"));
    expect(retour.status).toBe(303);
    expect(retour.headers.get("location")).toBe("/composer");
    const b = (await y.onglet().lireSession()) as Compte;
    expect(b.id).not.toBe(a.id);
  });

  it("versions : enregistrer, renommer, supprimer ; la sixième est refusée", async () => {
    const x = navigateur();
    const adresse = m.adresseNeuve("versions");
    await x.onglet().demanderLien(adresse, `${ORIGINE}/composer`);
    await x.confirmerLien(adresse);
    const onglet = x.onglet();
    await onglet.lireSession();
    const logo = `data:image/png;base64,${"iVBORw0KGgo".padEnd(1_000_000, "A")}`;
    const avecLogo = { ...m.chargeValide("<b>Gras</b> & <script>x</script>"), values: "<i>valeurs</i>", logo };
    const premiere = await onglet.creerVersion("Première", avecLogo);
    await onglet.renommerVersion(premiere.id, "Renommée");
    for (let i = 2; i <= 5; i++) await onglet.creerVersion(`V${i}`, m.chargeValide());
    await expect(onglet.creerVersion("Sixième", m.chargeValide())).rejects.toThrow("LIMIT");
    await onglet.supprimerVersion(premiere.id);
    const liste = await onglet.listerVersions();
    expect(liste).toHaveLength(4);
    expect(liste.map((v) => v.name)).not.toContain("Renommée");
    await expect(onglet.creerVersion("Logo SVG", { ...m.chargeValide(), logo: "data:image/svg+xml;base64,PHN2Zz4=" })).rejects.toThrow("LOGO");
  });

  it("la Déclaration écrite dans deux onglets : le plus ancien est refusé, et le dit", async () => {
    const x = navigateur();
    const adresse = m.adresseNeuve("onglets");
    await x.onglet().demanderLien(adresse, `${ORIGINE}/composer`);
    await x.confirmerLien(adresse);
    const un = x.onglet();
    const deux = x.onglet();
    const compte = (await un.lireSession())!.id;
    await deux.lireSession();
    const lueUn = await un.lireDeclaration(compte);
    const lueDeux = await deux.lireDeclaration(compte);
    expect(lueUn).toBeNull();
    expect(lueDeux).toBeNull();
    expect(await deux.ecrireDeclaration(declaration("depuis deux"), 1, compte)).toEqual({ statut: "ecrite", revision: 1 });
    // L'onglet un, ouvert avant, propose la même révision : refusé, il apprend la révision du compte.
    expect(await un.ecrireDeclaration(declaration("depuis un"), 1, compte)).toEqual({ statut: "perimee", revision: 1 });
    expect((await un.lireDeclaration(compte))!.payload).toMatchObject({ raisonEtre: "depuis deux" });
  });

  it("changement de compte dans le même navigateur, sans sortie : rien du premier ne reste devant le second", async () => {
    const x = navigateur();
    const adresseA = m.adresseNeuve("premier");
    const adresseB = m.adresseNeuve("second");
    await x.onglet().demanderLien(adresseA, `${ORIGINE}/composer`);
    await x.confirmerLien(adresseA);
    const ancien = x.onglet();
    const vus = suivre(ancien);
    const a = (await ancien.lireSession())!.id;
    await ancien.creerVersion("Version de A", m.chargeValide());
    expect((await ancien.ecrireDeclaration(declaration("de A"), 1, a)).statut).toBe("ecrite");

    // Un autre onglet du même navigateur ouvre une session B : le cookie change.
    const nouveau = x.onglet();
    await nouveau.demanderLien(adresseB, `${ORIGINE}/composer`);
    await x.confirmerLien(adresseB);
    const b = (await nouveau.lireSession())!.id;
    await laisserPasser();
    // L'onglet ancien suit, prévenu par le canal.
    expect(vus.at(-1)).toBe(b);

    // Une écriture préparée pour A, partie de l'onglet ancien, n'atterrit pas chez B.
    expect(await ancien.ecrireDeclaration(declaration("de A, en retard"), 2, a)).toEqual({ statut: "erreur" });
    const chezB = await banc.admin.query("select count(*)::int as n from composer.declarations where compte_id = $1", [b]);
    expect(chezB.rows[0].n).toBe(0);
    // Et la liste lue pour B ne porte rien de A.
    expect(await nouveau.listerVersions()).toEqual([]);
    await expect(nouveau.lireDeclaration(a)).rejects.toThrow("COMPTE");
  });

  it("une réponse partie pour A qui arrive quand l'onglet affiche B est écartée", async () => {
    const x = navigateur();
    const adresseA = m.adresseNeuve("ecart-a");
    const adresseB = m.adresseNeuve("ecart-b");
    await x.onglet().demanderLien(adresseA, `${ORIGINE}/composer`);
    await x.confirmerLien(adresseA);
    const onglet = x.onglet();
    await onglet.lireSession();
    await onglet.creerVersion("De A", m.chargeValide());
    // Le cookie passe à B sans que cet onglet le sache encore (pas de canal).
    const y = x.onglet();
    await y.demanderLien(adresseB, `${ORIGINE}/composer`);
    await x.confirmerLien(adresseB);
    await expect(onglet.listerVersions()).rejects.toThrow("COMPTE");
  });

  it("sortie avec le service arrêté, puis redémarré : la session est fermée au retour", async () => {
    const x = navigateur();
    const adresse = m.adresseNeuve("sortie");
    await x.onglet().demanderLien(adresse, `${ORIGINE}/composer`);
    await x.confirmerLien(adresse);
    const onglet = x.onglet();
    const vus = suivre(onglet);
    const compte = (await onglet.lireSession())!.id;
    const ouvertes = async () =>
      (await banc.admin.query("select count(*)::int as n from composer.sessions where compte_id = $1", [compte])).rows[0].n;
    expect(await ouvertes()).toBe(1);

    x.etat.arrete = true;
    await onglet.sortir();
    expect(vus.at(-1)).toBeNull();
    expect(x.stockage.getItem(CLE_SORTIE)).not.toBeNull();
    // Rechargement pendant la panne : personne.
    expect(await x.onglet().lireSession()).toBeNull();
    expect(await ouvertes()).toBe(1);

    x.etat.arrete = false;
    expect(await x.onglet().lireSession()).toBeNull();
    expect(await ouvertes()).toBe(0);
    expect(x.stockage.getItem(CLE_SORTIE)).toBeNull();
  });

  it("lien ouvert dans un autre navigateur : refusé proprement, et le lien reste au demandeur", async () => {
    const demandeur = navigateur();
    const autre = navigateur();
    const adresse = m.adresseNeuve("autre-nav");
    await demandeur.onglet().demanderLien(adresse, `${ORIGINE}/composer`);
    const jeton = m.dernierJeton(banc, adresse);
    const refus = await autre.confirmerLien(adresse, jeton);
    expect(refus.status).toBe(303);
    expect(refus.headers.get("location")).toBe("/connexion/confirmer?erreur=NAVIGATEUR");
    expect(await autre.onglet().lireSession()).toBeNull();
    const accepte = await demandeur.confirmerLien(adresse, jeton);
    expect(accepte.headers.get("location")).toBe("/composer");
    expect((await demandeur.onglet().lireSession())!.email).toBe(adresse);
  });
});
