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

function Inline({
  text,
  keyBase,
  onTermClick,
  locale,
}: {
  text: string;
  keyBase: string;
  onTermClick?: TermClick;
  locale: Locale;
}) {
  return (
    <>
      {parseInline(text).map((seg, i) => {
        const key = `${keyBase}-${i}`;
        if (seg.emphasis === "bold")
          return (
            <strong key={key} className="font-semibold text-slate-900">
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
              ? linkifyTerms(seg.text, onTermClick, key, locale)
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
  return (
    <>
      {parseBlocks(text).map((bloc, i) => {
        if (bloc.kind === "bullets")
          return (
            <ul key={i} className="mb-3 ml-5 list-disc space-y-1 last:mb-0">
              {bloc.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  <Inline
                    text={item}
                    keyBase={`${keyBase}${i}-${j}`}
                    onTermClick={onTermClick}
                    locale={locale}
                  />
                </li>
              ))}
            </ul>
          );
        if (bloc.kind === "numbered")
          return (
            <ol key={i} className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">
              {bloc.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  <Inline
                    text={item.text}
                    keyBase={`${keyBase}${i}-${j}`}
                    onTermClick={onTermClick}
                    locale={locale}
                  />
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="mb-3 leading-relaxed last:mb-0">
            <Inline
              text={bloc.text}
              keyBase={`${keyBase}${i}`}
              onTermClick={onTermClick}
              locale={locale}
            />
          </p>
        );
      })}
    </>
  );
}

export default Prose;
