import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export 100 % statique (HTML/JS/CSS) → déployable sur hébergement mutualisé
  // OVH (Apache, pas de runtime Node). L'app n'a aucune route serveur ;
  // PDF et (à venir) Supabase tournent côté navigateur.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
