import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Les motifs ci-dessus sont ancrés à la racine : un dossier de travail
    // imbriqué (les worktrees git de .claude/, par exemple) apporte ses propres
    // .next/ et out/, et `npm run lint` se met alors à rapporter des erreurs
    // venues de JavaScript généré, sur une autre branche que celle qu'on tient.
    "**/.next/**",
    "**/out/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
