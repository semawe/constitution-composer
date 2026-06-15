import type { Metadata } from "next";
import CartoClientEN from "@/components/CartoClientEN";

export const metadata: Metadata = {
  title: "Directory of Holacracy organizations",
  description:
    "67 organizations practicing Holacracy, shared governance, or related modes, compiled by Sémawé. Filter by governance type and country.",
  alternates: {
    canonical: "https://constitution-composer.com/en/cartographie",
    languages: { fr: "https://constitution-composer.com/cartographie" },
  },
};

export default function CartographiePageEN() {
  return <CartoClientEN />;
}
