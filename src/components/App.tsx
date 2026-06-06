"use client";

import { useEffect, useState } from "react";
import Composer from "@/components/Composer";
import Principes, { type PrincipesData } from "@/components/Principes";
import Glossaire from "@/components/Glossaire";
import ThemeToggle from "@/components/ThemeToggle";
import type { ConstitutionData } from "@/lib/constitution";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

const LS_BRANDING = "cc-branding";

function tabClass(active: boolean) {
  return `rounded-full px-4 py-1.5 text-sm font-medium transition ${
    active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
  }`;
}

export default function App({
  constitution,
  principes,
}: {
  constitution: ConstitutionData;
  principes: PrincipesData;
}) {
  const [view, setView] = useState<
    "constitution" | "principes" | "glossaire"
  >("constitution");

  // Lien admin visible seulement pour les e-mails associés.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth
      .getSession()
      .then(({ data }) => setIsAdmin(isAdminEmail(data.session?.user?.email)));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) =>
      setIsAdmin(isAdminEmail(s?.user?.email)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Clic sur un terme défini dans un document → bascule vers le glossaire et
  // défile jusqu'à l'entrée correspondante.
  const goToTerm = (key: string) => {
    setView("glossaire");
    setTimeout(() => {
      document
        .getElementById(`glossaire-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Identité visuelle partagée par les deux documents (logo / police / couleur
  // de titre). Persistée localement ; les versions sauvegardées la mémorisent
  // aussi côté Constitution.
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

  return (
    <div>
      <nav className="sticky top-0 z-40 flex h-11 items-center justify-center gap-1 border-b border-slate-200 bg-background/90 backdrop-blur">
        <button
          onClick={() => setView("constitution")}
          className={tabClass(view === "constitution")}
        >
          Constitution
        </button>
        <button
          onClick={() => setView("principes")}
          className={tabClass(view === "principes")}
        >
          Déclaration de Principes
        </button>
        <button
          onClick={() => setView("glossaire")}
          className={tabClass(view === "glossaire")}
        >
          Glossaire
        </button>
        {isAdmin && (
          <a
            href="/admin/"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Admin
          </a>
        )}
        <ThemeToggle />
      </nav>

      {/* Les deux vues restent montées (masquage CSS) : changer d'onglet ne
          perd plus la saisie en cours de l'autre vue. */}
      <div className={view === "constitution" ? "" : "hidden"}>
        <Composer
          data={constitution}
          branding={branding}
          onTermClick={goToTerm}
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
        <Glossaire font={font} />
      </div>
    </div>
  );
}
