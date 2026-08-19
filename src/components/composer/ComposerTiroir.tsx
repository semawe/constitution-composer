import { type ReactNode } from "react";
import { motion } from "framer-motion";

// Le tiroir du panneau sur petit écran. Sorti de `Composer.tsx` (tâche #1057) :
// c'est une pièce d'interface, elle ne décide rien.
//
// Note pour la reprise visuelle : le voile et le panneau portent un `exit` qui ne
// peut pas s'exécuter, faute d'`AnimatePresence` autour. C'est inerte, pas cassé
// — une promesse d'animation que le code ne tient pas. Laissé tel quel pour ne
// pas changer le rendu dans un découpage à iso-rendu.

export function ComposerTiroir({
  ouvert,
  onClose,
  fermer,
  children,
}: {
  ouvert: boolean;
  onClose: () => void;
  /** Libellé du bouton de fermeture. */
  fermer: string;
  children: ReactNode;
}) {
  if (!ouvert) return null;
  return (

          <motion.div key="drawer" className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/30"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="absolute left-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto bg-background p-5 shadow-xl"
            >
              <div className="mb-2 flex justify-end">
                <button
                  onClick={onClose}
                  aria-label={fermer}
                  className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              {children}
            </motion.aside>
          </motion.div>
  );
}
