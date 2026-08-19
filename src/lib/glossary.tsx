// Glossaire : données + détection des termes définis dans le texte du document.
// Les termes (capitalisés) sont soulignés en pointillé, avec infobulle (définition)
// et clic vers le glossaire. Source : data/glossaire.fr.json.

import type { ReactNode } from "react";
import glossaireFr from "@/data/glossaire.fr.json";
import glossaireEn from "@/data/glossaire.en.json";
import type { Locale } from "@/lib/i18n";

export interface GlossaryTerm {
  key: string;
  term: string;
  definition: string;
}

const DATA = { fr: glossaireFr, en: glossaireEn };

export function glossary(locale: Locale = "fr"): GlossaryTerm[] {
  return DATA[locale].terms as GlossaryTerm[];
}

export const GLOSSARY = glossary("fr");
export const GLOSSARY_META = glossaireFr.meta as {
  title: string;
  intro: string;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Index par langue, construit une seule fois. Alternance triée par longueur
// décroissante : les termes composés priment sur les plus courts (« Membres du
// Cercle » avant « Cercle »). Sensible à la casse pour ne capter que les usages
// définis (initiale majuscule), avec un « s » final optionnel pour les pluriels.
function buildIndex(locale: Locale) {
  const terms = glossary(locale);
  return {
    byTerm: new Map(terms.map((t) => [t.term, t])),
    re: new RegExp(
      "(" +
        [...terms]
          .sort((a, b) => b.term.length - a.term.length)
          .map((t) => escapeRegex(t.term))
          .join("|") +
        ")(s)?",
      "g",
    ),
  };
}

const INDEX: Record<Locale, ReturnType<typeof buildIndex>> = {
  fr: buildIndex("fr"),
  en: buildIndex("en"),
};

export function linkifyTerms(
  text: string,
  onTermClick: (key: string) => void,
  keyBase: string,
  locale: Locale = "fr",
  /**
   * Termes déjà glosés dans la même unité de lecture (un article, insertions
   * comprises). Fourni, il limite le soulignement à la première occurrence.
   *
   * Le fond emploie ses termes définis à chaque phrase : sans cette borne, le
   * corps constitutionnel portait deux à quatre pointillés par phrase, et la
   * texture dominante de la page devenait le soulignement plutôt que le texte.
   * La page /lite, qui ne glose pas, se lit nettement mieux — c'est la
   * comparaison qui a tranché. Gloser une fois par article garde la définition
   * à portée sans la répéter.
   */
  seen?: Set<string>,
): ReactNode[] {
  const { byTerm, re: TERM_RE } = INDEX[locale];
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(text)) !== null) {
    const t = byTerm.get(m[1]);
    if (!t) continue;
    if (seen) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
    }
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      // Un bouton et non un `span` cliquable : le renvoi au glossaire était
      // hors d'atteinte au clavier, et l'infobulle `title` seule ne dit rien
      // à un lecteur d'écran.
      <button
        key={`${keyBase}-g${i++}`}
        type="button"
        onClick={() => onTermClick(t.key)}
        title={t.definition}
        aria-label={`${m[0]} : ${t.definition}`}
        className="cursor-help border-b border-dotted border-slate-400/70 text-left transition hover:border-slate-600"
      >
        {m[0]}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}
