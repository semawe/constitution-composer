"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

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
        onClose();
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

    document.addEventListener("keydown", surTouche, true);
    return () => {
      document.removeEventListener("keydown", surTouche, true);
      // Le focus revient d'où il venait : sinon la personne se retrouve en haut
      // de la page, sans savoir ce qui vient de se passer.
      ouvrantElement?.focus?.();
    };
  }, [onClose]);

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
