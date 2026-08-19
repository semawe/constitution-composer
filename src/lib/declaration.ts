// Frontière d'entrée de la Déclaration de Principes, à l'image de
// `normalizeActive()` pour la Constitution.
//
// Le payload vient du compte (Supabase) ou du navigateur (localStorage) : il
// peut être ancien, incohérent ou forgé. Sans ce passage, un ordre portant deux
// fois le même identifiant duplique un principe **à l'écran et dans le PDF**, et
// un principe personnalisé sans texte sort en titre nu. La revue adverse du
// 18/08/2026 l'a relevé : les états lus de l'extérieur n'étaient pas normalisés.

import { type ContentRef } from "./releases";

export interface CustomPrinciple {
  id: string;
  title: string;
  text: string;
}

export interface DeclarationPayload {
  /** 2 depuis l'archivage des releases. Absent = Déclaration d'avant. */
  schemaVersion?: 2;
  /**
   * Les Principes dont cette Déclaration est faite. Une Déclaration est le
   * document que les ratificateurs signent : elle doit pouvoir être relue telle
   * qu'elle a été signée, même après une évolution du texte des Principes.
   */
  content?: ContentRef;
  removed: string[];
  custom: CustomPrinciple[];
  order: string[];
  raisonEtre: string;
  devise: string;
  ratifiers: string;
  signatories: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v : "");

/** La référence de contenu, si elle a la forme attendue. */
function reference(v: unknown): ContentRef | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const locale = texte(r.locale);
  const release = texte(r.release);
  if (!release || (locale !== "fr" && locale !== "en")) return undefined;
  return {
    locale,
    release,
    sha256: texte(r.sha256),
    kind: "principes",
  };
}

/**
 * Normalise un payload venu de l'extérieur contre les principes du fond.
 *
 * `builtinIds` = les identifiants du fond servi. Trois passes : les principes
 * personnalisés sont validés et dédoublonnés, les identifiants inconnus sont
 * écartés, et l'ordre est reconstruit sans doublon ni trou (les identifiants
 * connus absents de l'ordre sont ajoutés à la fin, dans l'ordre du fond).
 */
export function normalizeDeclaration(
  raw: unknown,
  builtinIds: readonly string[],
): DeclarationPayload {
  const p = (raw ?? {}) as Record<string, unknown>;

  const custom: CustomPrinciple[] = [];
  const vus = new Set<string>(builtinIds);
  if (Array.isArray(p.custom)) {
    for (const item of p.custom) {
      if (!item || typeof item !== "object") continue;
      const c = item as Record<string, unknown>;
      const id = texte(c.id).trim();
      // Un identifiant vide, ou qui collide avec un principe du fond ou un autre
      // principe personnalisé, produirait deux entrées indistinguables.
      if (!id || vus.has(id)) continue;
      vus.add(id);
      custom.push({ id, title: texte(c.title), text: texte(c.text) });
    }
  }

  const connus = new Set<string>([...builtinIds, ...custom.map((c) => c.id)]);

  const filtrer = (v: unknown): string[] => {
    const out: string[] = [];
    const dejaVu = new Set<string>();
    if (Array.isArray(v))
      for (const x of v) {
        const id = texte(x);
        if (!connus.has(id) || dejaVu.has(id)) continue;
        dejaVu.add(id);
        out.push(id);
      }
    return out;
  };

  const order = filtrer(p.order);
  // Un principe connu absent de l'ordre reprend sa place à la fin : il ne doit
  // pas disparaître du document au prétexte qu'un payload ancien l'ignore.
  for (const id of [...builtinIds, ...custom.map((c) => c.id)])
    if (!order.includes(id)) order.push(id);

  return {
    ...(p.schemaVersion === 2 ? { schemaVersion: 2 as const } : {}),
    ...(reference(p.content) ? { content: reference(p.content) } : {}),
    removed: filtrer(p.removed),
    custom,
    order,
    raisonEtre: texte(p.raisonEtre),
    devise: texte(p.devise),
    ratifiers: texte(p.ratifiers),
    signatories: texte(p.signatories),
  };
}
