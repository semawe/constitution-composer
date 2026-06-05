import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export 100 % statique (HTML/JS/CSS) → déployable sur hébergement mutualisé
  // OVH (Apache, pas de runtime Node). L'app n'a aucune route serveur ;
  // PDF et (à venir) Supabase tournent côté navigateur.
  output: "export",
  // Slash final → l'export écrit out/<route>/index.html (et non <route>.html),
  // servi de façon fiable par Apache (DirectoryIndex) sur hébergement mutualisé.
  // Indispensable dès qu'il y a un sous-chemin comme /admin.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
