"use client";

import { useState } from "react";
import { type ConstitutionData } from "@/lib/constitution";
import { type ContentRef } from "@/lib/releases";
import { type COMPOSER, type Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { COACHES } from "@/components/composer/coachs";

// L'export PDF du document composé : l'attente, l'échec, et la proposition de
// session offerte qui suit un export réussi. Sorti de `Composer.tsx` (#1057).
//
// Deux choses s'y jouent qui ne sont pas de l'affichage : le mur du compte (on
// n'exporte pas sans compte) et la référence du texte, qui part avec le document
// pour qu'on puisse dire plus tard de quel fond il est tiré.

type Ui = (typeof COMPOSER)["fr"];

export function useComposerExport({
  t,
  locale,
  data,
  active,
  contentRef,
  showIntent,
  titre,
  valeurs,
  branding,
  onGate,
  estConnecte,
}: {
  t: Ui;
  locale: Locale;
  data: ConstitutionData;
  active: ReadonlySet<string>;
  contentRef: ContentRef | null;
  showIntent: boolean;
  titre: string;
  valeurs: string;
  branding: { logo: string; font: string; titleColor: string };
  onGate: () => void;
  estConnecte: () => boolean;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [booking, setBooking] = useState(false);
  const [exportPrompted, setExportPrompted] = useState(false);

  const doGeneratePdf = async () => {
    setPdfBusy(true);
    setPdfError(false);
    track("pdf_export");
    try {
      const { generateComposedPdfBlob } = await import("@/lib/pdf");
      const blob = await generateComposedPdfBlob(data, active, {
        title: titre,
        values: valeurs,
        titleColor: branding.titleColor || undefined,
        font: branding.font,
        logo: branding.logo || undefined,
        locale,
        // Le PDF rend ce que l'écran montre : les notes d'intention suivent
        // l'interrupteur, elles ne disparaissent plus en silence à l'export.
        showIntent,
        // Le PDF dit de quel texte il est tiré : sans cela, deux exports du même
        // nom peuvent différer sans qu'on puisse le savoir après coup.
        contentRef: contentRef ?? undefined,
        date: new Date().toLocaleDateString(t.dateLocale, {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug =
        (titre || "constitution")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "constitution";
      a.download = `${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Moment de haute intention : on propose la session offerte (une fois).
      if (!exportPrompted && COACHES.length > 0) {
        setExportPrompted(true);
        setBooking(true);
      }
    } catch {
      // L'export est le geste que la personne est venue faire : son échec ne
      // peut pas se résumer à un bouton qui reprend son état normal.
      setPdfError(true);
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePdf = () => {
    if (!estConnecte()) {
      onGate();
      track("gate", { contexte: "pdf" });
      return;
    }
    doGeneratePdf();
  };

  // Sauvegarde la composition avant la redirection Google (restaurée au retour).

  /**
   * Fait descendre le moteur PDF sans rien produire. Appelé au survol ou au focus
   * du bouton d'export : l'import est mis en cache par le navigateur, donc le clic
   * n'attend plus le réseau. Silencieux par construction — un préchargement qui
   * échoue ne doit rien dire, le clic réessaiera et parlera, lui.
   */
  const precharger = () => {
    void import("@/lib/pdf").catch(() => {});
  };

  return {
    pdfBusy,
    pdfError,
    booking,
    setBooking,
    doGeneratePdf,
    handlePdf,
    precharger,
  };
}
