import { BACKEND } from "@/lib/build-info";

// Ce que les deux racines du site (française et anglaise) posent dans `<head>`.
// Le site a deux layouts racine parce que la langue du document se déclare sur
// `<html>`, et qu'un layout unique la figeait en français pour les pages
// anglaises aussi (audit du 04/10/2026, F15).
export function Tete() {
  return (
    <>
      {/* Ce que ce build embarque comme backend, lisible dans l'HTML exporté :
          c'est sur cette marque que le déploiement décide, et non sur une
          sous-chaîne du bundle (voir `scripts/deploy-ovh.mjs`). */}
      <meta name="cc-backend" content={BACKEND} />
      {/* Applique avant le paint le thème choisi (dark par défaut) et le
          masquage du bandeau d'introduction s'il a été fermé. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(localStorage.getItem('cc-theme')==='light')document.documentElement.classList.remove('dark');if(localStorage.getItem('cc-intro-dismissed')==='1')document.documentElement.classList.add('intro-off')}catch(e){}",
        }}
      />
      {/* Umami Cloud (mesure sans cookie) : actif seulement si l'id est fourni au build. */}
      {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
        />
      )}
    </>
  );
}
