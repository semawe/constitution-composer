// La grammaire du balisage léger du fond, en un seul endroit.
//
// Le fond n'est pas du Markdown : il en emploie quatre motifs et rien d'autre —
// paragraphes séparés par une ligne vide, listes à puces (« - »), listes
// numérotées (« 1. »), gras (`**…**`) et italique (`*…*`). Cette grammaire était
// réécrite dans cinq rendus (le Composer, le PDF, les pages /lite et /micro, le
// visualiseur d'administration), et les copies avaient dérivé : le PDF ignorait
// l'italique, les pages /lite l'ignorent encore et affichent des astérisques en
// clair sur des pages indexées. Un seul analyseur, plusieurs rendus : la dérive
// n'a plus d'endroit où se produire.
//
// Ce que la grammaire ne fait PAS, volontairement : les listes imbriquées. Un
// bloc qui mêle « 1. » et « - » retombe en paragraphe, marqueurs visibles. Le
// test « aucun marqueur de liste brut ne survit dans l'export » interdit qu'un
// tel bloc entre dans le fond ; le jour où le besoin est réel, c'est ici que la
// forme s'ajoute, et les rendus suivent.

export type Emphasis = "plain" | "bold" | "italic";

export interface InlineSegment {
  emphasis: Emphasis;
  text: string;
}

export type MarkupBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: { marker: string; text: string }[] };

/** Découpe une ligne en segments d'emphase. Les segments vides sont écartés. */
export function parseInline(text: string): InlineSegment[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .flatMap<InlineSegment>((part) => {
      if (!part) return [];
      if (part.startsWith("**") && part.endsWith("**"))
        return [{ emphasis: "bold", text: part.slice(2, -2) }];
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
        return [{ emphasis: "italic", text: part.slice(1, -1) }];
      return [{ emphasis: "plain", text: part }];
    });
}

/**
 * Découpe brut : les blocs d'un texte, séparés par une ligne vide, tels qu'écrits.
 * Exporté pour les rares usages qui indexent les blocs sans les rendre (l'outil
 * d'administration des insertions) : la règle de découpage ne se réécrit pas.
 */
export function chunks(text: string): string[] {
  return text.split(/\n\n/);
}

/** Découpe un texte du fond en blocs : paragraphes, listes à puces, listes numérotées. */
export function parseBlocks(text: string): MarkupBlock[] {
  return chunks(text).map((chunk): MarkupBlock => {
    const lines = chunk.split("\n");
    const trimmed = lines.map((l) => l.trim());
    if (lines.length > 1 && trimmed.every((l) => /^- /.test(l)))
      return { kind: "bullets", items: trimmed.map((l) => l.replace(/^- /, "")) };
    if (lines.length > 1 && trimmed.every((l) => /^\d+\.\s/.test(l)))
      return {
        kind: "numbered",
        items: trimmed.map((l) => ({
          // Le marqueur écrit est conservé : le PDF le rend tel quel, là où le
          // HTML laisse <ol> numéroter. Les deux ne peuvent diverger que si le
          // fond numérote de travers, ce qu'un test du fond interdit.
          marker: `${/^(\d+)\./.exec(l)?.[1] ?? ""}.`,
          text: l.replace(/^\d+\.\s/, ""),
        })),
      };
    return { kind: "paragraph", text: chunk };
  });
}
