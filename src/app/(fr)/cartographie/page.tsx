import type { Metadata } from "next";
import OfflineRedirect from "@/components/OfflineRedirect";

// Cartographie temporairement hors ligne (décision 2026-06-17 : à affiner avant
// remise en ligne). Le composant CartoClient et ses données restent en place.
export const metadata: Metadata = {
  title: "Cartographie — hors ligne",
  robots: { index: false, follow: false },
};

export default function CartographiePage() {
  return (
    <OfflineRedirect
      to="/"
      message="La cartographie est temporairement hors ligne. Redirection vers l'accueil…"
    />
  );
}
