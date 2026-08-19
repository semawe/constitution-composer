"use client";

import { useEffect, useState } from "react";
import {
  MAX_COMPOSITIONS,
  type CompositionPayload,
  type SavedComposition,
  deleteComposition,
  listCompositions,
  migrateComposition,
  renameComposition,
  repinComposition,
  saveComposition,
} from "@/lib/compositions";
import { type ConstitutionData } from "@/lib/constitution";
import {
  type ContentRef,
  CURRENT_RELEASE,
  currentContentRef,
  isOutdated,
  releaseLabel,
  resolveContent,
} from "@/lib/releases";
import { type COMPOSER, type Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";

// Les versions enregistrées d'une composition : la liste, ses messages, et les
// six gestes qui les manipulent (enregistrer, ouvrir, renommer, supprimer, figer
// sur le texte du jour, en créer une version sur le texte du jour).
//
// Sorti de `Composer.tsx` (tâche #1057), où ces cent cinquante lignes vivaient au
// milieu du reste. Le hook ne touche pas au document : quand une version s'ouvre,
// il rend au Composer le fond à afficher et l'état à poser, par `onApply`. C'est
// ce qui garde la résolution d'une release (stricte, elle peut refuser) au même
// endroit que le reste des décisions.

type Ui = (typeof COMPOSER)["fr"];

/** Ce qu'une version ouverte demande au Composer de poser. */
export interface VersionAppliquee {
  fond: ConstitutionData;
  contentRef: ContentRef | null;
  payload: SavedComposition["payload"];
}

export function useComposerVersions({
  t,
  locale,
  account,
  fondCourant,
  onGate,
  onApply,
  composition,
}: {
  t: Ui;
  locale: Locale;
  account: boolean;
  /** Le fond du jour : celui d'une version non figée, et celui d'un rejeu. */
  fondCourant: ConstitutionData;
  onGate: (raison: "save") => void;
  onApply: (v: VersionAppliquee) => void;
  /** L'état courant du document, lu au moment d'enregistrer. */
  composition: () => Omit<CompositionPayload, "schemaVersion" | "content">;
}) {
  const [versions, setVersions] = useState<SavedComposition[]>([]);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const [versionsUnread, setVersionsUnread] = useState(false);
  const [versionBusy, setVersionBusy] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);
  const [aFiger, setAFiger] = useState<SavedComposition | null>(null);
  const [aRejouer, setARejouer] = useState<SavedComposition | null>(null);

  useEffect(() => {
    if (!account) {
      // remise à zéro de la liste à la déconnexion, sur changement de
      // dépendance.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVersions([]);
      return;
    }
    let alive = true;
    listCompositions()
      .then((rows) => alive && setVersions(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [account]);

  const refreshVersions = () =>
    listCompositions()
      .then((rows) => {
        setVersions(rows);
        setVersionsUnread(false);
      })
      // Sans ce message, une lecture ratée s'affichait « 0/5 » : indistinguable
      // d'un compte sans version, donc une invitation à tout resaisir.
      .catch(() => setVersionsUnread(true));

  const handleSaveVersion = async () => {
    if (!account) {
      onGate("save");
      return;
    }
    if (versions.length >= MAX_COMPOSITIONS) {
      setVersionMsg(t.limitReached(MAX_COMPOSITIONS));
      return;
    }
    setVersionBusy(true);
    setVersionMsg(null);
    try {
      const charge = composition();
      await saveComposition(
        (charge.title || t.untitled).trim(),
        charge,
        locale,
      );
      await refreshVersions();
      setVersionMsg(t.saved);
      track("sauvegarde_version");
    } catch {
      setVersionMsg(t.saveFailed);
    } finally {
      setVersionBusy(false);
    }
  };

  /**
   * Ouvre une version : résout d'abord de quel texte elle est faite, et refuse
   * plutôt que d'en afficher un autre. Le document lui-même est posé par le
   * Composer, à qui l'on rend le fond et la charge.
   */
  const handleLoadVersion = (v: SavedComposition) => {
    const resolution = resolveContent(v.payload.content);
    setAFiger(null);
    setARejouer(null);
    if (resolution.statut === "release-absente") {
      setReleaseMsg(t.releaseMissing(releaseLabel(resolution.release, locale)));
      return;
    }
    if (resolution.statut === "empreinte-divergente") {
      setReleaseMsg(t.releaseMismatch(releaseLabel(resolution.release, locale)));
      return;
    }
    const fond = resolution.statut === "resolue" ? resolution.data : fondCourant;
    if (resolution.statut === "non-figee") {
      setReleaseMsg(t.releaseNotPinned);
      setAFiger(v);
    } else if (isOutdated(v.payload.content)) {
      setReleaseMsg(t.releasePinned(releaseLabel(resolution.release, locale)));
      setARejouer(v);
    } else {
      setReleaseMsg(null);
    }
    onApply({ fond, contentRef: v.payload.content ?? null, payload: v.payload });
    setVersionMsg(t.loaded(v.name));
  };

  /** Fige une version d'avant l'archivage sur le texte du jour, à la demande. */
  const handlePinVersion = async (v: SavedComposition) => {
    try {
      await repinComposition(v.id, v.payload, locale);
      await refreshVersions();
      setAFiger(null);
      setReleaseMsg(null);
      onApply({
        fond: fondCourant,
        contentRef: currentContentRef(locale),
        payload: v.payload,
      });
    } catch {
      setVersionMsg(t.versionActionFailed);
    }
  };

  /** Crée une version de celle-ci sur le texte du jour. L'originale ne bouge pas. */
  const handleMigrateVersion = async (v: SavedComposition) => {
    const nom = t.releaseMigrateName(v.name, releaseLabel(CURRENT_RELEASE, locale));
    try {
      const creee = await migrateComposition(v, nom, locale);
      await refreshVersions();
      setARejouer(null);
      setReleaseMsg(t.releaseMigrated(creee.name));
      onApply({
        fond: fondCourant,
        contentRef: currentContentRef(locale),
        payload: creee.payload,
      });
    } catch (error) {
      setReleaseMsg(
        error instanceof Error && error.message === "LIMIT"
          ? t.releaseMigrateFull(MAX_COMPOSITIONS)
          : t.versionActionFailed,
      );
    }
  };

  const handleRenameVersion = async (v: SavedComposition) => {
    const name = window.prompt(t.renamePrompt, v.name);
    if (!name || !name.trim()) return;
    try {
      await renameComposition(v.id, name.trim());
      await refreshVersions();
    } catch {
      setVersionMsg(t.versionActionFailed);
    }
  };

  const handleDeleteVersion = async (v: SavedComposition) => {
    if (!window.confirm(t.confirmDelete(v.name))) return;
    try {
      await deleteComposition(v.id);
      await refreshVersions();
      setVersionMsg(null);
    } catch {
      setVersionMsg(t.versionActionFailed);
    }
  };


  return {
    versions,
    versionMsg,
    setVersionMsg,
    versionsUnread,
    versionBusy,
    releaseMsg,
    aFiger,
    aRejouer,
    handleSaveVersion,
    handleLoadVersion,
    handleRenameVersion,
    handleDeleteVersion,
    handlePinVersion,
    handleMigrateVersion,
    refreshVersions,
  };
}
