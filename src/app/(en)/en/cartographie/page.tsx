import type { Metadata } from "next";
import OfflineRedirect from "@/components/OfflineRedirect";

// Directory temporarily offline (decision 2026-06-17). CartoClientEN and its
// data remain in the repo for a later relaunch.
export const metadata: Metadata = {
  title: "Directory — offline",
  robots: { index: false, follow: false },
};

export default function CartographiePageEN() {
  return (
    <OfflineRedirect
      to="/en"
      message="The directory is temporarily offline. Redirecting to the home page…"
    />
  );
}
