import { type ConstitutionData } from "@/lib/constitution";
import { type COMPOSER } from "@/lib/i18n";

// Le sommaire du document, sorti du rail.
//
// Il y ouvrait la marche, six lignes avant la première commande d'édition, et
// c'est ce qui laissait le rail déborder de sa fenêtre : 1 059 px de contenu pour
// 836 visibles, dont 182 pour le seul sommaire — avec sa propre barre de
// défilement, ce que le diagnostic reprochait nommément. Replier les tiers avait
// fait la moitié du chemin ; sortir le sommaire fait l'autre.
//
// Sa place est dans la marge du texte, du côté où l'œil revient : ce n'est pas
// une commande d'atelier, c'est un repère de lecture. La marge droite sert alors
// deux fois — les libellés des modules insérés et lui — au lieu de porter
// 176 px pour un seul libellé.
//
// Il ne connaît que les blocs et le bloc courant : aucune décision ici.

type Ui = (typeof COMPOSER)["fr"];

export function ComposerSommaire({
  data,
  t,
  activeId,
  goTo,
}: {
  data: ConstitutionData;
  t: Ui;
  /** Bloc actuellement sous les yeux, surligné dans le sommaire. */
  activeId: string;
  goTo: (id: string) => void;
}) {
  return (
    <nav aria-label={t.toc}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t.toc}
      </h2>
      <div className="mt-2 space-y-0.5">
        {data.blocks.map((b) => {
          const on = activeId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => goTo(b.id)}
              className={`block w-full border-l-2 py-1 pl-3 text-left leading-snug transition ${
                on
                  ? "border-teal-500 bg-accent-faint"
                  : "border-rule hover:border-rule-strong hover:bg-surface-subtle/50"
              }`}
            >
              <span
                className={`block text-[0.82rem] ${
                  on
                    ? "font-medium text-teal-800"
                    : "text-muted hover:text-body"
                }`}
              >
                {b.heading}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
