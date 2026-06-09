import type { NextConfig } from "next";

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
};

export default nextConfig;
