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

// Le logo est censé être une data: URL produite par le lecteur de fichier local.
// Rien ne garantit qu'un payload venu de la base en soit une : une composition
// insérée directement peut y placer une URL externe, qui ferait alors sortir une
// requête du navigateur de qui l'affiche (adresse IP, heure de consultation,
// ressource interne atteignable). On n'accepte donc qu'une image en data: URL,
// bornée en taille.
const LOGO_MAX_CHARS = 1_500_000; // ~1,1 Mo de binaire encodé en base64
// Le SVG est volontairement absent : une data: URL SVG peut porter du script.
const LOGO_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function safeLogo(value: unknown): string {
  if (typeof value !== "string" || value.length > LOGO_MAX_CHARS) return "";
  return LOGO_RE.test(value) ? value : "";
}

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
