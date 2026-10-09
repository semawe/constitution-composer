"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { type ConstitutionData } from "@/lib/constitution";
import {
  type ContentRef,
  type Locale,
  canonicalRef,
  currentContentRef,
  isCurrentRef,
  resolveContent,
} from "@/lib/releases";

// Le brouillon local et la navigation dans le document. Sorti de `Composer.tsx`
// (tâche #1057).
//
// Trois choses qui vont ensemble, et qu'on ne remarque que lorsqu'elles manquent :
// le brouillon (sans lui, un rafraîchissement effaçait les valeurs saisies et les
// modules cochés tant qu'aucune version n'était enregistrée), le surlignage du
// sommaire au défilement, et le défilement vers ce qu'une bascule vient de
// changer — sans quoi on coche un module sans voir ce qu'il fait au texte.

const CLE = "cc_compose";

/** Ce que le navigateur garde du document en cours. */
interface Brouillon {
  /** null : le brouillon ne dit rien des modules, on garde ceux du départ. */
  active: string[] | null;
  title: string;
  values: string;
  /**
   * Le fond du document en cours. Un brouillon est, comme une version, un
   * couple contenu + référence : sans elle, recharger après avoir ouvert une
   * version ancienne reposait sa saisie sur le texte du jour.
   */
  content?: ContentRef | null;
  /**
   * Le compte sous lequel ce brouillon a été écrit, ou null s'il est anonyme.
   * Un brouillon nominatif ne se restaure que pour son compte.
   */
  proprietaire?: string | null;
}

/** Ce qu'un brouillon restauré demande au Composer de poser, d'un seul geste. */
export interface BrouillonRestaure {
  fond: ConstitutionData;
  contentRef: ContentRef;
  active: string[] | null;
  title: string;
  values: string;
}

function lire(): Brouillon | null {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return null;
    const s = JSON.parse(raw) as Record<string, unknown>;
    if (!s || typeof s !== "object") return null;
    return {
      active: Array.isArray(s.active)
        ? s.active.filter((x): x is string => typeof x === "string")
        : null,
      title: typeof s.title === "string" ? s.title : "",
      values: typeof s.values === "string" ? s.values : "",
      content:
        s.content && typeof s.content === "object"
          ? (s.content as ContentRef)
          : null,
      proprietaire: typeof s.proprietaire === "string" ? s.proprietaire : null,
    };
  } catch {
    return null;
  }
}

export function useComposerBrouillon({
  fondCourant,
  locale,
  data,
  contentRef,
  active,
  title,
  values,
  sessionConnue,
  identite,
  onRestaurer,
  onEcarter,
  onNavigation,
}: {
  /** Le fond du jour : celui d'un brouillon sans référence, ou non résoluble. */
  fondCourant: ConstitutionData;
  locale: Locale;
  data: ConstitutionData;
  contentRef: ContentRef | null;
  active: ReadonlySet<string>;
  title: string;
  values: string;
  /** La session a été lue : `identite` dit qui est là, ou que personne ne l'est. */
  sessionConnue: boolean;
  identite: string | null;
  /** Pose le brouillon restauré sur le document : fond, référence et contenu. */
  onRestaurer: (b: BrouillonRestaure) => void;
  /** Un brouillon d'un autre compte a été écarté : rien de lui ne doit rester. */
  onEcarter: () => void;
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

  // Le brouillon se restaure **une fois**, à l'arrivée sur la page. L'effet
  // dépendait du fond affiché : ouvrir une version changeait ce fond, relançait
  // la lecture, et le brouillon d'avant venait recouvrir le titre, les valeurs
  // et les modules du document qu'on venait d'ouvrir (audit du 04/10/2026, F02).
  // Ouvrir un document est un geste explicite ; restaurer un brouillon ne l'est
  // pas, et ne doit jamais passer après lui.
  const tente = useRef(false);
  /** Un document a été ouvert pendant que le brouillon se résolvait : on s'efface. */
  const devance = useRef(false);

  // Les dernières valeurs des rappels, lues au moment d'agir : les capturer en
  // dépendance relancerait la restauration à chaque rendu du composant.
  const rappels = useRef({ onRestaurer, onEcarter });
  useEffect(() => {
    rappels.current = { onRestaurer, onEcarter };
  });

  // Le brouillon est lu dans localStorage après le montage : le lire pendant le
  // rendu ferait diverger l'HTML prérendu (modules par défaut) du premier rendu
  // client (brouillon restauré).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (tente.current) return;
    const brouillon = lire();
    if (!brouillon) {
      tente.current = true;
      setDraftLoaded(true);
      return;
    }
    // Un brouillon nominatif attend de savoir qui est là. Un brouillon anonyme
    // n'attend personne : c'est lui qui franchit l'aller-retour de connexion.
    if (brouillon.proprietaire && !sessionConnue) return;
    tente.current = true;
    if (brouillon.proprietaire && brouillon.proprietaire !== identite) {
      // Écrit sous un autre compte, sur ce navigateur : il ne s'affiche pas, et
      // il ne reste pas (audit du 04/10/2026, F06).
      try {
        localStorage.removeItem(CLE);
      } catch {}
      rappels.current.onEcarter();
      setDraftLoaded(true);
      return;
    }
    void (async () => {
      let fond = fondCourant;
      let reference = currentContentRef(locale);
      const voulue = canonicalRef(brouillon.content);
      if (voulue && !isCurrentRef(voulue, locale)) {
        const resolution = await resolveContent(voulue);
        if (resolution.statut === "resolue") {
          fond = resolution.data;
          reference = voulue;
        }
        // Sinon la saisie se pose sur le texte du jour. Un brouillon n'est pas
        // un document adopté : mieux vaut rendre ce qui a été tapé que le
        // retenir au nom d'un texte qu'on ne retrouve pas.
      }
      if (!devance.current)
        rappels.current.onRestaurer({
          fond,
          contentRef: reference,
          active: brouillon.active,
          title: brouillon.title,
          values: brouillon.values,
        });
      setDraftLoaded(true);
    })();
  }, [sessionConnue, identite, fondCourant, locale]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const ecrire = () => {
    try {
      localStorage.setItem(
        CLE,
        JSON.stringify({
          active: [...active],
          title,
          values,
          content: contentRef,
          proprietaire: identite,
        } satisfies Brouillon),
      );
    } catch {}
  };

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(ecrire, 400);
    return () => clearTimeout(timer);
    // `ecrire` lit l'état du rendu courant : ce sont ses entrées qui commandent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, active, title, values, contentRef, identite]);

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

  /**
   * Met le brouillon à l'abri tout de suite, sans attendre le report habituel :
   * appelé avant une redirection OAuth, qui quitte la page.
   */
  const mettreAbriBrouillon = ecrire;

  /**
   * Un document vient d'être posé explicitement (version ouverte, remise à
   * zéro) : une restauration encore en cours ne doit plus rien écrire dessus.
   */
  const cederLaPlace = () => {
    devance.current = true;
  };

  /** Efface le brouillon du navigateur : il appartenait à qui vient de partir. */
  const oublierBrouillon = () => {
    try {
      localStorage.removeItem(CLE);
    } catch {}
  };

  return {
    activeId,
    goTo,
    viser,
    brouillonPret: draftLoaded,
    mettreAbriBrouillon,
    cederLaPlace,
    oublierBrouillon,
  };
}
