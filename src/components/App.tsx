"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Composer from "@/components/Composer";
import Principes, { type PrincipesData } from "@/components/Principes";
import Glossaire from "@/components/Glossaire";
import Marketplace from "@/components/Marketplace";
import ThemeToggle from "@/components/ThemeToggle";
import type { ConstitutionData } from "@/lib/constitution";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { APP_UI, type Locale } from "@/lib/i18n";

const LS_BRANDING = "cc-branding";

function tabClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
    active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
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
  const [view, setView] = useState<
    "constitution" | "principes" | "glossaire" | "appstore"
  >("constitution");

  const openInComposer = (anchor: string) => {
    setView("constitution");
    setTimeout(() => {
      document
        .getElementById(anchor)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userName, setUserName] = useState("");
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const sync = (u: { email?: string; user_metadata?: Record<string, unknown> } | null) => {
      setIsAdmin(isAdminEmail(u?.email));
      setSignedIn(!!u);
      const name =
        (u?.user_metadata?.given_name as string) ||
        (u?.user_metadata?.full_name as string) ||
        u?.email ||
        "";
      setUserName(name);
    };
    sb.auth.getSession().then(({ data }) => sync(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) =>
      sync(s?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Ouvre la connexion (modal géré dans le Composer) depuis n'importe quel
  // onglet : on bascule sur la Constitution pour que le modal soit visible.
  const requestSignIn = () => {
    setView("constitution");
    window.dispatchEvent(new Event("cc:open-signin"));
  };

  const goToTerm = (key: string) => {
    setView("glossaire");
    setTimeout(() => {
      document
        .getElementById(`glossaire-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const [logo, setLogo] = useState("");
  const [font, setFont] = useState("source-serif");
  const [titleColor, setTitleColor] = useState("");
  const [brandingLoaded, setBrandingLoaded] = useState(false);

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

  const homeHref = locale === "en" ? "/en" : "/";
  const otherLangHref = locale === "en" ? "/composer" : "/en/composer";

  return (
    <div>
      <nav className="sticky top-0 z-40 flex h-11 items-center border-b border-slate-200 bg-background/90 px-2 backdrop-blur">
        <Link
          href={homeHref}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
        >
          ← {t.home}
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto">
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
          {isAdmin && (
            <a
              href="/admin/"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Admin
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 pl-1">
          {signedIn ? (
            <span
              className="hidden max-w-[10rem] items-center gap-1 truncate rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 sm:inline-flex"
              title={userName}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              {userName}
            </span>
          ) : (
            <button
              onClick={requestSignIn}
              className="rounded-full border border-teal-600 px-3 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50"
            >
              {t.signIn}
            </button>
          )}
          <Link
            href={otherLangHref}
            title={locale === "en" ? "Passer en français" : "Switch to English"}
            className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13" strokeLinecap="round"/>
            </svg>
            {t.switchLang}
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className={view === "constitution" ? "" : "hidden"}>
        <Composer
          data={constitution}
          branding={branding}
          onTermClick={goToTerm}
          locale={locale}
        />
      </div>
      <div className={view === "principes" ? "" : "hidden"}>
        <Principes
          data={principes}
          logo={logo}
          font={font}
          titleColor={titleColor}
          onTermClick={goToTerm}
        />
      </div>
      <div className={view === "glossaire" ? "" : "hidden"}>
        <Glossaire font={font} locale={locale} />
      </div>
      <div className={view === "appstore" ? "" : "hidden"}>
        <Marketplace
          data={constitution}
          onOpen={openInComposer}
          locale={locale}
          signedIn={signedIn}
          onRequestSignIn={requestSignIn}
        />
      </div>
    </div>
  );
}
