import { type ReactNode, useRef } from "react";
import { motion } from "framer-motion";
import { useDialogue } from "@/components/Modale";

// Le tiroir du panneau sur petit écran. Sorti de `Composer.tsx` (tâche #1057) :
// c'est une pièce d'interface, elle ne décide rien.
//
// Le `exit` que portaient le voile et le panneau ne s'exécutait pas, faute
// d'`AnimatePresence` au-dessus : `if (!ouvert) return null` démontait l'arbre
// avant que Framer puisse le jouer. Il est retiré, et non honoré.
//
// L'essai a été fait, et c'est lui qui tranche : entouré d'`AnimatePresence`, le
// tiroir ne se démonte plus qu'au terme de son animation de sortie. Quand cette
// animation ne se termine pas — onglet en arrière-plan, fil principal saturé,
// rAF étranglé — le tiroir reste monté, et avec lui un voile qui couvre tout
// l'écran : l'utilisateur est enfermé hors de sa page. Constaté ici, trois
// secondes après la fermeture, voile et panneau toujours présents.
//
// Fermer est un changement d'état, pas la conséquence d'une animation réussie.
// C'est la leçon du matin sur le corps constitutionnel, appliquée à
// l'interaction : trois cents millisecondes de glissé à la fermeture ne valent
// pas le risque de rester coincé, et c'est sur un tiroir plein écran que rester
// coincé coûte le plus cher. L'entrée reste animée — si elle s'interrompt, le
// tiroir est simplement à mi-course, et il se ferme toujours.
//
// Le tiroir est une boîte modale : il couvre la page d'un voile. Il en porte donc
// le contrat — rôle, focus qui entre et tourne dans le panneau, Échap, fond figé,
// focus rendu au bouton qui l'a ouvert (audit du 04/10/2026, F17). Le contrat vit
// dans `useDialogue`, partagé avec `Modale`.
export function ComposerTiroir({
  ouvert,
  onClose,
  fermer,
  nom,
  children,
}: {
  ouvert: boolean;
  onClose: () => void;
  /** Libellé du bouton de fermeture. */
  fermer: string;
  /** Nom du panneau, annoncé à l'ouverture. */
  nom: string;
  children: ReactNode;
}) {
  if (!ouvert) return null;
  return (
    <Panneau onClose={onClose} fermer={fermer} nom={nom}>
      {children}
    </Panneau>
  );
}

function Panneau({
  onClose,
  fermer,
  nom,
  children,
}: {
  onClose: () => void;
  fermer: string;
  nom: string;
  children: ReactNode;
}) {
  const boite = useRef<HTMLElement>(null);
  useDialogue(boite, onClose, { figerLeFond: true });
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-slate-900/30"
      />
      <motion.aside
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-label={nom}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="absolute left-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto overscroll-contain bg-background p-5 shadow-xl"
      >
        <div className="mb-2 flex justify-end">
          <button
            onClick={onClose}
            aria-label={fermer}
            className="rounded-full px-2 py-1 text-muted hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>
        {children}
      </motion.aside>
    </div>
  );
}
