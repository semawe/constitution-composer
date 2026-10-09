import type { Metadata } from "next";
import OfflineRedirect from "@/components/OfflineRedirect";
import { CARTE_ORGANISATIONS_URL } from "@/lib/links";

// The directory has left the Composer: the map of organizations practicing
// Holacracy is published on semawe.fr, in French (ERP task 1086). The address
// stays for links already shared.
export const metadata: Metadata = {
  title: "Map of organizations practicing Holacracy",
  robots: { index: false, follow: true },
};

export default function CartographiePageEN() {
  return (
    <OfflineRedirect
      to={CARTE_ORGANISATIONS_URL}
      message="The map of organizations practicing Holacracy is published on semawe.fr (in French). Redirecting…"
    />
  );
}
