import type { Metadata } from "next";
import CartoClient from "@/components/CartoClient";

export const metadata: Metadata = {
  title: "Cartographie des organisations en Holacratie",
  description:
    "67 organisations qui pratiquent l'Holacratie, la gouvernance partagée ou des modes voisins. Filtrage par gouvernance et par pays. Ressource proposée par Sémawé.",
};

export default function CartographiePage() {
  return <CartoClient />;
}
