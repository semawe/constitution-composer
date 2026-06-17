import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Tampon de build (affiché en pied de page) : version du package, date du build
// et hash court du commit. Calculés ici pour être bakés dans le bundle au build,
// sans fichier généré ni working tree sali. En dev, recalculés au démarrage.
const buildVersion = (
  JSON.parse(readFileSync("./package.json", "utf8")) as { version: string }
).version;
const buildCommit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();
const buildDate = new Date().toISOString().slice(0, 10);

const nextConfig: NextConfig = {
  // Export 100 % statique (HTML/JS/CSS) → déployable sur hébergement mutualisé
  // OVH (Apache, pas de runtime Node). L'app n'a aucune route serveur ;
  // PDF et (à venir) Supabase tournent côté navigateur.
  output: "export",
  // URLs canoniques sans slash final : l'export écrit out/<route>.html. Apache
  // les sert sans extension via public/.htaccess (réécriture interne vers .html
  // si le fichier existe + redirections de canonicalisation slash/.html).
  trailingSlash: false,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
};

export default nextConfig;
