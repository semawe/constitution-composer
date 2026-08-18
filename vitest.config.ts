import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// L'alias `@` de tsconfig n'est pas connu de Vitest : sans lui, tout module de
// test qui remonte jusqu'à un import `@/…` échoue à charger.
export default defineConfig({
  test: {
    // Sans cette exclusion, un worktree git imbriqué (.claude/worktrees/…, créé
    // par les sessions Claude) fait découvrir deux fois chaque fichier de test :
    // la suite passe au vert sur des tests d'une autre branche, en double.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
