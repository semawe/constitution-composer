import { type ReactNode } from "react";
import { parseBlocks, parseInline } from "@/lib/markup";
import { linkifyTerms } from "@/lib/glossary";
import type { Locale } from "@/lib/i18n";

// Rendu HTML du fond : le seul. Le Composer, les pages /lite et /micro et le
// visualiseur d'administration en tenaient chacun une copie, et les copies
// avaient dérivé. La grammaire vit dans `src/lib/markup.ts`, la mise en forme
// ici, et le PDF (`src/lib/pdf.tsx`) rend la même grammaire à sa façon.
//
// Pas de directive « use client » : sans `onTermClick`, ce composant ne porte
// aucun gestionnaire d'événement et reste rendu côté serveur sur les pages
// statiques. Les termes cliquables ne sont demandés que par le Composer, qui est
// déjà un composant client.

type TermClick = (key: string) => void;

/**
 * Rendu des segments d'emphase d'une ligne.
 *
 * Fonction appelée directement, et non composant monté en JSX : le relevé des
 * termes déjà glosés (`seen`) doit se remplir et mourir dans un seul passage de
 * rendu. Confié à un composant enfant, il survivait au passage — React peut
 * rejouer un rendu, et le relevé, déjà plein, ne soulignait plus rien : 67
 * termes glosés côté serveur, 3 après hydratation. Ici, tout le texte d'un bloc
 * est résolu dans le corps de `Prose`, avant qu'aucun élément ne soit monté.
 */
function inline(
  text: string,
  keyBase: string,
  locale: Locale,
  onTermClick?: TermClick,
  seen?: Set<string>,
): ReactNode {
  return (
    <>
      {parseInline(text).map((seg, i) => {
        const key = `${keyBase}-${i}`;
        if (seg.emphasis === "bold")
          return (
            <strong key={key} className="font-semibold text-strong">
              {seg.text}
            </strong>
          );
        if (seg.emphasis === "italic")
          return (
            <em key={key} className="italic">
              {seg.text}
            </em>
          );
        return (
          <span key={key}>
            {onTermClick
              ? linkifyTerms(seg.text, onTermClick, key, locale, seen)
              : seg.text}
          </span>
        );
      })}
    </>
  );
}

export function Prose({
  text,
  onTermClick,
  locale = "fr",
  keyBase = "p",
}: {
  text: string;
  /** Fourni par le Composer : souligne les termes du glossaire et les rend cliquables. */
  onTermClick?: TermClick;
  locale?: Locale;
  keyBase?: string;
}): ReactNode {
  // Un relevé par bloc de texte : un terme défini n'est souligné qu'à sa
  // première apparition. Le fond emploie ses termes à chaque phrase ; sans cette
  // borne, le corps constitutionnel portait deux à quatre pointillés par phrase
  // (277 sur la page), et la texture dominante devenait le soulignement plutôt
  // que le texte. La page /lite, qui ne glose pas, se lit nettement mieux —
  // c'est la comparaison qui a tranché.
  const seen = onTermClick ? new Set<string>() : undefined;
  return (
    <>
      {parseBlocks(text).map((bloc, i) => {
        if (bloc.kind === "bullets")
          return (
            <ul key={i} className="mb-3 ml-5 list-disc space-y-1 last:mb-0">
              {bloc.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {inline(item, `${keyBase}${i}-${j}`, locale, onTermClick, seen)}
                </li>
              ))}
            </ul>
          );
        if (bloc.kind === "numbered")
          return (
            <ol key={i} className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">
              {bloc.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {inline(
                    item.text,
                    `${keyBase}${i}-${j}`,
                    locale,
                    onTermClick,
                    seen,
                  )}
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="mb-3 leading-relaxed last:mb-0">
            {inline(bloc.text, `${keyBase}${i}`, locale, onTermClick, seen)}
          </p>
        );
      })}
    </>
  );
}

export default Prose;
