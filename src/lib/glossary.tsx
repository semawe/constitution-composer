// Glossaire : données + détection des termes définis dans le texte du document.
// Les termes (capitalisés) sont soulignés en pointillé, avec infobulle (définition)
// et clic vers le glossaire. Source : data/glossaire.fr.json.

import type { ReactNode } from "react";
import glossaireData from "@/data/glossaire.fr.json";

export interface GlossaryTerm {
  key: string;
  term: string;
  definition: string;
}

export const GLOSSARY = glossaireData.terms as GlossaryTerm[];
export const GLOSSARY_META = glossaireData.meta as {
  title: string;
  intro: string;
};

const byTerm = new Map(GLOSSARY.map((t) => [t.term, t]));

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Alternance triée par longueur décroissante : les termes composés priment sur
// les plus courts (« Membres du Cercle » avant « Cercle »). Sensible à la casse
// pour ne capter que les usages définis (initiale majuscule), avec un « s »
// final optionnel pour les pluriels.
const TERM_RE = new RegExp(
  "(" +
    [...GLOSSARY]
      .sort((a, b) => b.term.length - a.term.length)
      .map((t) => escapeRegex(t.term))
      .join("|") +
    ")(s)?",
  "g",
);

export function linkifyTerms(
  text: string,
  onTermClick: (key: string) => void,
  keyBase: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(text)) !== null) {
    const t = byTerm.get(m[1]);
    if (!t) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span
        key={`${keyBase}-g${i++}`}
        onClick={() => onTermClick(t.key)}
        title={t.definition}
        className="cursor-help border-b border-dotted border-slate-400/70 transition hover:border-slate-600"
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}
