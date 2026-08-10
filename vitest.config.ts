import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// L'alias `@` de tsconfig n'est pas connu de Vitest : sans lui, tout module de
// test qui remonte jusqu'à un import `@/…` échoue à charger.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
