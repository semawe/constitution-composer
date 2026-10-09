import type { Metadata } from "next";
import OfflineRedirect from "@/components/OfflineRedirect";
import { CARTE_ORGANISATIONS_URL } from "@/lib/links";

// La cartographie a quitté le Composer : la carte des organisations en
// Holacratie est publiée sur semawe.fr (tâche ERP 1086). L'adresse reste pour
// les liens déjà diffusés.
export const metadata: Metadata = {
  title: "Carte des organisations en Holacratie",
  robots: { index: false, follow: true },
};

export default function CartographiePage() {
  return (
    <OfflineRedirect
      to={CARTE_ORGANISATIONS_URL}
      message="La carte des organisations en Holacratie est publiée sur semawe.fr. Redirection…"
    />
  );
}
