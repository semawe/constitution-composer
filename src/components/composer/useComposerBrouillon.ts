"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  type ConstitutionData,
  normalizeActive,
} from "@/lib/constitution";

// Le brouillon local et la navigation dans le document. Sorti de `Composer.tsx`
// (tâche #1057).
//
// Trois choses qui vont ensemble, et qu'on ne remarque que lorsqu'elles manquent :
// le brouillon (sans lui, un rafraîchissement effaçait les valeurs saisies et les
// modules cochés tant qu'aucune version n'était enregistrée), le surlignage du
// sommaire au défilement, et le défilement vers ce qu'une bascule vient de
// changer — sans quoi on coche un module sans voir ce qu'il fait au texte.

export function useComposerBrouillon({
  data,
  active,
  setActive,
  title,
  setTitle,
  values,
  setValues,
  onNavigation,
}: {
  data: ConstitutionData;
  active: ReadonlySet<string>;
  setActive: (s: ReadonlySet<string>) => void;
  title: string;
  setTitle: (v: string) => void;
  values: string;
  setValues: (v: string) => void;
  /** Appelé quand on navigue : referme le tiroir mobile. */
  onNavigation: () => void;
}) {
  const [activeId, setActiveId] = useState<string>(data.blocks[0]?.id ?? "");
  // Le défilement ciblé respecte le réglage système des animations réduites.
  const reduce = useReducedMotion();

  // Scrollspy : surligne dans le sommaire la section la plus haute visible.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveId((vis[0].target as HTMLElement).id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    data.blocks.forEach((b) => {
      const el = document.getElementById(b.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [data.blocks]);

  // Brouillon local. Il couvre deux besoins : le retour de redirection Google
  // (round-trip OAuth) et, surtout, le simple rechargement de page — sans lui,
  // le texte saisi dans « Valeurs et principes » et les modules activés étaient
  // perdus dès qu'on rafraîchissait, tant qu'aucune version n'avait été
  // sauvegardée. Le brouillon reste local, jamais envoyé au compte tout seul.
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Le brouillon est lu dans localStorage après le montage : le lire pendant le
  // rendu ferait diverger l'HTML prérendu (modules par défaut) du premier rendu
  // client (brouillon restauré).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc_compose");
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.active)) setActive(normalizeActive(data, s.active));
        if (typeof s.title === "string" && s.title) setTitle(s.title);
        if (typeof s.values === "string") setValues(s.values);
      }
    } catch {}
    setDraftLoaded(true);
    // Les poseurs d'état viennent du composant et sont stables ; les relire en
    // dépendance relancerait la lecture du brouillon à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "cc_compose",
          JSON.stringify({ active: [...active], title, values }),
        );
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [draftLoaded, active, title, values]);

  const goTo = (id: string) => {
    setActiveId(id); // retour immédiat, sans attendre le scrollspy
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    onNavigation();
  };
  // Après que la bascule a re-rendu le document, on défile vers la modification.
  /** Ce vers quoi défiler au prochain rendu, posé par une bascule de module. */
  const pendingScroll = useRef<{
    primary?: string;
    fallback?: string;
  } | null>(null);
  const viser = (cible: { primary?: string; fallback?: string }) => {
    pendingScroll.current = cible;
  };
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    pendingScroll.current = null;
    const el =
      (target.primary && document.getElementById(target.primary)) ||
      (target.fallback && document.getElementById(target.fallback));
    if (!el) return;
    // Laisser l'insertion se monter (commit React + montage Framer) avant de
    // viser sa position.
    const timer = setTimeout(
      () =>
        el.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "center",
        }),
      60,
    );
    return () => clearTimeout(timer);
  }, [active, reduce]);

  // Mes versions (Phase B) : charge la liste dès qu'un compte est actif.


  /**
   * Met le brouillon à l'abri tout de suite, sans attendre le report habituel :
   * appelé avant une redirection OAuth, qui quitte la page.
   */
  const mettreAbriBrouillon = () => {

    try {
      localStorage.setItem(
        "cc_compose",
        JSON.stringify({ active: [...active], title, values }),
      );
    } catch {}
  };

  return { activeId, goTo, viser, mettreAbriBrouillon };
}
