"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

// La seule modale de l'application.
//
// Les quatre boîtes de dialogue en tenaient chacune une copie, et aucune ne
// portait `role="dialog"`, ne piégeait le focus, ne le restituait à la fermeture,
// ni ne se fermait avec Échap (revue adverse du 18/08/2026). Conséquence : un
// lecteur d'écran continuait de parcourir la page derrière, et la tabulation
// sortait de la boîte sans qu'on puisse revenir.
//
// Ce composant ne s'occupe pas de l'apparence : il porte le contrat
// d'accessibilité, et laisse chaque appelant habiller son contenu.

/** Ce qui peut recevoir le focus dans une boîte de dialogue. */
const FOCUSABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Le contrat clavier d'une boîte de dialogue : le focus y entre à l'ouverture,
 * y tourne en boucle, Échap la ferme, et le focus revient d'où il venait à la
 * fermeture. Partagé avec le tiroir mobile du Composer, qui est lui aussi une
 * boîte modale et n'en portait aucune des garanties (audit du 04/10/2026, F17).
 */
export function useDialogue(
  boite: RefObject<HTMLElement | null>,
  onClose: () => void,
  { figerLeFond = false }: { figerLeFond?: boolean } = {},
) {
  // La fermeture demandée est lue au moment de la touche, pas capturée par
  // l'effet. Les appelants passent une fonction fléchée neuve à chaque rendu :
  // en dépendance, elle relançait l'effet à chaque caractère saisi dans un champ
  // de la boîte, et le focus repartait sur le premier contrôle (audit du
  // 04/10/2026, F03 — l'adresse de connexion ne se tapait pas au-delà d'une
  // lettre).
  const fermer = useRef(onClose);
  useEffect(() => {
    fermer.current = onClose;
  });

  // Prise et restitution du focus : au montage et au démontage, rien d'autre.
  useEffect(() => {
    const ouvrantElement = document.activeElement as HTMLElement | null;
    // Le focus entre dans la boîte : sans cela, la tabulation reprend au début
    // de la page, derrière le fond.
    const premier =
      boite.current?.querySelector<HTMLElement>(FOCUSABLES) ?? boite.current;
    premier?.focus?.();

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fermer.current();
        return;
      }
      if (e.key !== "Tab" || !boite.current) return;
      // Piège à focus : la tabulation tourne en boucle dans la boîte.
      const cibles = [
        ...boite.current.querySelectorAll<HTMLElement>(FOCUSABLES),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (cibles.length === 0) return;
      const debut = cibles[0];
      const fin = cibles[cibles.length - 1];
      if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault();
        debut.focus();
      } else if (e.shiftKey && document.activeElement === debut) {
        e.preventDefault();
        fin.focus();
      }
    };

    // Le document derrière un panneau plein écran ne doit pas défiler sous le
    // doigt : on fige, et on rend la valeur d'origine en sortant.
    const debordement = document.body.style.overflow;
    if (figerLeFond) document.body.style.overflow = "hidden";

    document.addEventListener("keydown", surTouche, true);
    return () => {
      document.removeEventListener("keydown", surTouche, true);
      if (figerLeFond) document.body.style.overflow = debordement;
      // Le focus revient d'où il venait : sinon la personne se retrouve en haut
      // de la page, sans savoir ce qui vient de se passer.
      ouvrantElement?.focus?.();
    };
    // `boite` est un ref stable ; `figerLeFond` ne change pas en cours de vie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Modale({
  onClose,
  labelledBy,
  label,
  children,
  className = "relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl",
}: {
  /** Fermeture demandée : Échap, clic sur le fond, ou bouton de l'appelant. */
  onClose: () => void;
  /** Identifiant du titre qui nomme la boîte, quand elle en a un. */
  labelledBy?: string;
  /** Nom de la boîte à défaut de titre visible. */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const rendu = useId();
  useDialogue(boite, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        id={`modale-${rendu}`}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}

export default Modale;
