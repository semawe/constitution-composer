// Génère public/og.png (1200x630) pour les partages sociaux.
// Usage : node scripts/og-image.mjs  (sharp requis, devDependency)

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");

// Esthétique du site en dark mode : fond slate-900, texte slate clair,
// cases de modules cochées rappelant la composition à la carte.
const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#334155" stroke-width="2" rx="12"/>

  <!-- Colonne document stylisée à droite -->
  <g transform="translate(800,120)">
    <rect width="300" height="390" rx="8" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <rect x="28" y="36" width="160" height="14" rx="7" fill="#64748b"/>
    <rect x="28" y="70" width="244" height="8" rx="4" fill="#475569"/>
    <rect x="28" y="90" width="244" height="8" rx="4" fill="#475569"/>
    <rect x="28" y="110" width="180" height="8" rx="4" fill="#475569"/>
    <g transform="translate(28,150)">
      <rect width="22" height="22" rx="5" fill="#10b981"/>
      <path d="M5 11 l5 5 l8 -9" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="34" y="7" width="180" height="8" rx="4" fill="#94a3b8"/>
    </g>
    <g transform="translate(28,190)">
      <rect width="22" height="22" rx="5" fill="#10b981"/>
      <path d="M5 11 l5 5 l8 -9" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="34" y="7" width="140" height="8" rx="4" fill="#94a3b8"/>
    </g>
    <g transform="translate(28,230)">
      <rect width="22" height="22" rx="5" fill="none" stroke="#64748b" stroke-width="2"/>
      <rect x="34" y="7" width="160" height="8" rx="4" fill="#475569"/>
    </g>
    <rect x="28" y="290" width="244" height="8" rx="4" fill="#475569"/>
    <rect x="28" y="310" width="244" height="8" rx="4" fill="#475569"/>
    <rect x="28" y="330" width="120" height="8" rx="4" fill="#475569"/>
  </g>

  <!-- Texte -->
  <text x="96" y="200" font-family="Georgia, serif" font-size="30" letter-spacing="6" fill="#64748b">CONSTITUTION-COMPOSER.COM</text>
  <text x="96" y="300" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="#f1f5f9">Composez votre</text>
  <text x="96" y="385" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="#f1f5f9">Constitution</text>
  <text x="96" y="455" font-family="Georgia, serif" font-size="34" fill="#94a3b8">Holacracy v6 · socle + modules à la carte</text>
  <text x="96" y="505" font-family="Georgia, serif" font-size="34" fill="#94a3b8">PDF prêt à ratifier, à votre identité</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`OK → ${out}`);
