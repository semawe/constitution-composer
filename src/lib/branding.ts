// Identité visuelle partagée entre la Constitution et la Déclaration de
// Principes : police du document + utilitaires d'application CSS.
// (Le logo et la couleur de titre sont de simples chaînes gérées dans App.)

import type { CSSProperties } from "react";

export interface FontOption {
  key: string;
  label: string;
  stack: string;
}

// Polices du document (cf. @font-face dans globals.css + Font.register dans pdf.tsx).
export const FONT_OPTIONS: FontOption[] = [
  { key: "source-serif", label: "Source Serif", stack: "'Source Serif 4', Georgia, serif" },
  { key: "eb-garamond", label: "EB Garamond", stack: "'EB Garamond', Georgia, serif" },
  { key: "lora", label: "Lora", stack: "'Lora', Georgia, serif" },
  { key: "inter", label: "Inter", stack: "'Inter', system-ui, sans-serif" },
  { key: "ibm-plex", label: "IBM Plex Sans", stack: "'IBM Plex Sans', system-ui, sans-serif" },
];

export function fontStack(key: string): string {
  return FONT_OPTIONS.find((f) => f.key === key)?.stack ?? FONT_OPTIONS[0].stack;
}

// Variables à poser sur un conteneur de document. .doc-prose lit --font-serif ;
// les utilitaires font-serif/font-sans (Tailwind @theme inline) lisent les
// variables sources next/font.
export function fontVars(key: string): CSSProperties {
  const stack = fontStack(key);
  return {
    "--font-serif": stack,
    "--font-sans": stack,
    "--font-source-serif": stack,
    "--font-geist-sans": stack,
  } as CSSProperties;
}
