"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Composer from "@/components/Composer";
import type { PrincipesData } from "@/lib/principes-data";
import dynamic from "next/dynamic";
import Glossaire from "@/components/Glossaire";
import ThemeToggle from "@/components/ThemeToggle";

// Les trois onglets secondaires ne descendent qu'à l'ouverture. Auparavant les
// quatre étaient montés d'emblée et simplement masqués en CSS : le premier
// chargement de /composer embarquait tout leur JavaScript, initialisait leurs
// effets et leurs abonnements invisibles, et un bouton d'un onglet masqué restait
// cliquable (revue adverse du 18/08/2026 — et un piège rencontré le même jour
// dans une vérification, qui déclenchait l'export de l'autre onglet).
//
// Aucune perte de contenu indexable : /composer est en `noindex`, et chaque
// onglet restaure son brouillon depuis le navigateur à son montage.
const Principes = dynamic(() => import("@/components/Principes"), {
  ssr: false,
});
const Marketplace = dynamic(() => import("@/components/Marketplace"), {
  ssr: false,
});
import type { ConstitutionData } from "@/lib/constitution";
import { type Compte, getService } from "@/lib/service";
import { APP_UI, type Locale } from "@/lib/i18n";
import { reprendreVue } from "@/lib/intention";

const LS_BRANDING = "cc-branding";

type Vue = "constitution" | "principes" | "glossaire" | "appstore";
const VUES: readonly Vue[] = ["constitution", "principes", "glossaire", "appstore"];
const estVue = (v: string | null): v is Vue =>
  v !== null && (VUES as readonly string[]).includes(v);

/** L'onglet que l'URL désigne (`?vue=…`), ou null si elle n'en dit rien. */
function vueDeLUrl(): Vue | null {
  const v = new URLSearchParams(window.location.search).get("vue");
  return estVue(v) ? v : null;
}

/** L'URL de la page pour cet onglet : la Constitution est l'onglet sans paramètre. */
function urlDeLaVue(vue: Vue): string {
  const params = new URLSearchParams(window.location.search);
  if (vue === "constitution") params.delete("vue");
  else params.set("vue", vue);
  const q = params.toString();
  return window.location.pathname + (q ? `?${q}` : "") + window.location.hash;
}

function tabClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
    active ? "btn-ink" : "text-muted hover:bg-surface-muted"
  }`;
}

export default function App({
  constitution,
  principes,
  locale = "fr",
}: {
  constitution: ConstitutionData;
  principes: PrincipesData;
  locale?: Locale;
}) {
  const t = APP_UI[locale];
  // Un onglet ouvert une fois reste monté : le rouvrir ne doit pas relire le
  // brouillon ni relancer ses requêtes à chaque aller-retour.
  const [vus, setVus] = useState<Set<string>>(new Set(["constitution"]));
  const [view, setViewBrut] = useState<Vue>("constitution");
  const [glossaryOrigin, setGlossaryOrigin] = useState<{
    view: "constitution" | "principes";
    scrollY: number;
  } | null>(null);
  /** Affiche un onglet, sans toucher à l'historique. */
  const montrer = useCallback((v: Vue) => {
    setVus((s) => (s.has(v) ? s : new Set(s).add(v)));
    setViewBrut(v);
  }, []);
  // L'onglet vit dans l'URL. Il n'était qu'en mémoire : actualiser la
  // Déclaration, suivre un lien direct ou revenir en arrière ramenait toujours à
  // la Constitution (audit du 04/10/2026, F14). Changer d'onglet pousse une
  // entrée d'historique, pour que Précédent et Suivant fassent ce qu'on attend.
  const setView = useCallback(
    (v: Vue) => {
      montrer(v);
      const url = urlDeLaVue(v);
      const actuelle =
        window.location.pathname + window.location.search + window.location.hash;
      if (url !== actuelle) window.history.pushState(null, "", url);
    },
    [montrer],
  );

  // Un module à activer dans le Composer, demandé par l'App Store ou par la
  // fiche d'une app (`?activer=<id>`).
  const [demande, setDemande] = useState<{ module: string; n: number } | null>(
    null,
  );
  const compteurDemandes = useRef(0);
  const activerDansComposer = useCallback(
    (id: string) => {
      setView("constitution");
      compteurDemandes.current += 1;
      setDemande({ module: id, n: compteurDemandes.current });
    },
    [setView],
  );

  // L'URL est lue après le montage : la page est exportée en statique, donc
  // prérendue sans elle, et la lire pendant le rendu ferait diverger le premier
  // rendu client de l'HTML servi.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aActiver = params.get("activer");
    if (aActiver) {
      // Consommé une fois : un rechargement ne doit pas réactiver un module
      // que la personne aurait retiré entre-temps.
      params.delete("activer");
      params.delete("vue");
      const q = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (q ? `?${q}` : "") + window.location.hash,
      );
      compteurDemandes.current += 1;
      setDemande({ module: aActiver, n: compteurDemandes.current });
    } else {
      // À défaut d'onglet dans l'URL, celui d'où une connexion est partie.
      const retenue = reprendreVue();
      const vue = vueDeLUrl() ?? (estVue(retenue) ? retenue : null);
      if (vue && vue !== "constitution") {
        montrer(vue);
        window.history.replaceState(null, "", urlDeLaVue(vue));
      }
    }
    const surHistorique = () => montrer(vueDeLUrl() ?? "constitution");
    window.addEventListener("popstate", surHistorique);
    return () => window.removeEventListener("popstate", surHistorique);
  }, [montrer]);

  // La navigation dit sa hauteur à ce qui se cale dessous. Elle tient sur une
  // rangée à partir de 640 px et sur deux en dessous, et grandit avec la taille
  // du texte : une valeur en dur finit toujours par mentir.
  const racine = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const poser = () =>
      racine.current?.style.setProperty(
        "--cc-nav-h",
        `${nav.getBoundingClientRect().height}px`,
      );
    poser();
    const observateur = new ResizeObserver(poser);
    observateur.observe(nav);
    // L'observateur ne tire que lorsque la page est peinte ; l'événement de
    // redimensionnement couvre l'onglet resté en arrière-plan pendant qu'on
    // changeait la taille de la fenêtre.
    window.addEventListener("resize", poser);
    return () => {
      observateur.disconnect();
      window.removeEventListener("resize", poser);
    };
  }, []);

  const [signedIn, setSignedIn] = useState(false);
  const [userName, setUserName] = useState("");
  useEffect(() => {
    const service = getService();
    if (!service) return;
    const sync = (u: Compte | null) => {
      setSignedIn(!!u);
      setUserName(u?.prenom || u?.nom || u?.email || "");
    };
    service.lireSession().then(sync);
    return service.ecouterSession(sync);
  }, []);

  // Ouvre la connexion (modal géré dans le Composer) depuis n'importe quel
  // onglet : on bascule sur la Constitution pour que le modal soit visible.
  const requestSignIn = () => {
    setView("constitution");
    window.dispatchEvent(new Event("cc:open-signin"));
  };

  const goToTerm = (key: string) => {
    if (view === "constitution" || view === "principes") {
      setGlossaryOrigin({ view, scrollY: window.scrollY });
    }
    setView("glossaire");
    setTimeout(() => {
      document
        .getElementById(`glossaire-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const returnFromGlossary = () => {
    if (!glossaryOrigin) return;
    setView(glossaryOrigin.view);
    setTimeout(() => window.scrollTo({ top: glossaryOrigin.scrollY }), 60);
  };

  const [logo, setLogo] = useState("");
  const [font, setFont] = useState("source-serif");
  const [titleColor, setTitleColor] = useState("");
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  // Identité visuelle restaurée depuis localStorage après le montage. La lire
  // pendant le rendu ferait diverger l'HTML prérendu du premier rendu client.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_BRANDING);
      if (raw) {
        const b = JSON.parse(raw);
        if (typeof b.logo === "string") setLogo(b.logo);
        if (typeof b.font === "string") setFont(b.font);
        if (typeof b.titleColor === "string") setTitleColor(b.titleColor);
      }
    } catch {}
    setBrandingLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!brandingLoaded) return;
    try {
      localStorage.setItem(
        LS_BRANDING,
        JSON.stringify({ logo, font, titleColor }),
      );
    } catch {}
  }, [brandingLoaded, logo, font, titleColor]);

  const branding = {
    logo,
    setLogo,
    font,
    setFont,
    titleColor,
    setTitleColor,
  };

  const tabs = (
    <>
      <button
        onClick={() => setView("constitution")}
        className={tabClass(view === "constitution")}
      >
        {t.tabs.constitution}
      </button>
      <button
        onClick={() => setView("principes")}
        className={tabClass(view === "principes")}
      >
        {t.tabs.principes}
      </button>
      <button
        onClick={() => setView("glossaire")}
        className={tabClass(view === "glossaire")}
      >
        {t.tabs.glossaire}
      </button>
      <button
        onClick={() => setView("appstore")}
        className={tabClass(view === "appstore")}
      >
        {t.tabs.appstore}
      </button>
    </>
  );

  const homeHref = locale === "en" ? "/en" : "/";
  const otherLangHref = locale === "en" ? "/composer" : "/en/composer";

  return (
    <div ref={racine}>
      {/* Barre d'onglets. Sur téléphone, les quatre onglets ne tiennent pas
          dans la même rangée que le retour, le compte, la langue et le thème :
          ils prenaient 135 px de fenêtre pour 507 px de contenu, et le
          conteneur centré rendait même le premier onglet inatteignable
          (`scrollLeft` ne descend pas sous zéro). Ils passent donc sur une
          seconde rangée, pleine largeur, et ne se centrent qu'à partir du
          moment où la barre les contient. */}
      <nav
        ref={navigation}
        className="sticky top-0 z-40 border-b border-rule bg-background/90 px-2 backdrop-blur"
      >
        <div className="flex h-11 items-center">
          <Link
            href={homeHref}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-muted"
          >
            ← {t.home}
          </Link>
          <div className="no-scrollbar hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto sm:flex">
            {tabs}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
            {signedIn ? (
              <span
                className="hidden max-w-[10rem] items-center gap-1 truncate rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text sm:inline-flex"
                title={userName}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                {userName}
              </span>
            ) : (
              <button
                onClick={requestSignIn}
                className="rounded-full border border-teal-600 px-3 py-1 text-xs font-medium text-accent-text transition hover:bg-accent-soft"
              >
                {t.signIn}
              </button>
            )}
            <Link
              href={otherLangHref}
              title={locale === "en" ? "Passer en français" : "Switch to English"}
              className="flex items-center gap-1 rounded-full border border-rule px-2.5 py-1 text-xs font-medium text-muted transition hover:border-teal-400 hover:bg-accent-soft hover:text-accent-text"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13" strokeLinecap="round"/>
              </svg>
              {t.switchLang}
            </Link>
            <ThemeToggle locale={locale} />
          </div>
        </div>
        <div className="no-scrollbar -mx-2 flex items-center gap-1 overflow-x-auto px-2 pb-2 sm:hidden">
          {tabs}
        </div>
      </nav>

      <div className={view === "constitution" ? "" : "hidden"}>
        <Composer
          data={constitution}
          branding={branding}
          onTermClick={goToTerm}
          locale={locale}
          demande={demande}
        />
      </div>
      <div className={view === "principes" ? "" : "hidden"}>
        {vus.has("principes") && (
        <Principes
          data={principes}
          logo={logo}
          font={font}
          titleColor={titleColor}
          onTermClick={goToTerm}
          locale={locale}
        />
        )}
      </div>
      <div className={view === "glossaire" ? "" : "hidden"}>
        {vus.has("glossaire") && (
          <Glossaire
            font={font}
            locale={locale}
            onBack={glossaryOrigin ? returnFromGlossary : undefined}
          />
        )}
      </div>
      <div className={view === "appstore" ? "" : "hidden"}>
        {vus.has("appstore") && (
        <Marketplace
          data={constitution}
          onActiver={activerDansComposer}
          locale={locale}
          signedIn={signedIn}
          onRequestSignIn={requestSignIn}
        />
        )}
      </div>
    </div>
  );
}
