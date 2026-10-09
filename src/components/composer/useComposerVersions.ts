"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  identite,
  fondCourant,
  onGate,
  onApply,
  composition,
  reference,
}: {
  t: Ui;
  locale: Locale;
  account: boolean;
  /**
   * Qui est connecté. La liste se règle sur l'identité, pas sur « connecté ou
   * pas » : d'un compte à l'autre sans passer par la déconnexion, le booléen
   * reste vrai et la liste du premier restait à l'écran du second (audit du
   * 04/10/2026, F06).
   */
  identite: string | null;
  /** Le fond du jour : celui d'une version non figée, et celui d'un rejeu. */
  fondCourant: ConstitutionData;
  onGate: (raison: "save") => void;
  onApply: (v: VersionAppliquee) => void;
  /** L'état courant du document, lu au moment d'enregistrer. */
  composition: () => Omit<CompositionPayload, "schemaVersion" | "content">;
  /** Le fond du document affiché, lu au moment d'enregistrer. */
  reference: () => ContentRef;
}) {
  const [versions, setVersions] = useState<SavedComposition[]>([]);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const [versionsUnread, setVersionsUnread] = useState(false);
  const [versionBusy, setVersionBusy] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);
  const [aFiger, setAFiger] = useState<SavedComposition | null>(null);
  const [aRejouer, setARejouer] = useState<SavedComposition | null>(null);

  // Une réponse du réseau n'a de sens que pour le compte qui l'a demandée. La
  // génération avance à chaque changement d'identité : toute réponse partie
  // sous une génération antérieure est ignorée, liste comme messages.
  const generation = useRef(0);

  // Une seule lecture de la liste, pour le premier chargement comme pour les
  // suivants. Le premier avalait son erreur : une panne s'affichait « 0/5 »,
  // indistinguable d'un compte sans version, donc une invitation à tout
  // resaisir (audit du 04/10/2026, F11).
  const refreshVersions = useCallback(() => {
    const g = generation.current;
    return listCompositions()
      .then((rows) => {
        if (g !== generation.current) return;
        setVersions(rows);
        setVersionsUnread(false);
      })
      .catch(() => {
        if (g !== generation.current) return;
        setVersionsUnread(true);
      });
  }, []);

  useEffect(() => {
    generation.current += 1;
    // Remise à zéro sur changement d'identité : rien de ce qui concernait le
    // compte précédent ne reste, ni sa liste ni ce qu'on lui disait.
    /* eslint-disable react-hooks/set-state-in-effect */
    setVersions([]);
    setVersionsUnread(false);
    setVersionMsg(null);
    setReleaseMsg(null);
    setAFiger(null);
    setARejouer(null);
    setVersionBusy(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (identite) void refreshVersions();
  }, [identite, refreshVersions]);

  const handleSaveVersion = async () => {
    if (!account) {
      onGate("save");
      return;
    }
    if (versions.length >= MAX_COMPOSITIONS) {
      setVersionMsg(t.limitReached(MAX_COMPOSITIONS));
      return;
    }
    const g = generation.current;
    setVersionBusy(true);
    setVersionMsg(null);
    try {
      const charge = composition();
      await saveComposition(
        (charge.title || t.untitled).trim(),
        charge,
        // Le fond du document qu'on regarde, pas celui du jour : enregistrer
        // n'est pas migrer.
        reference(),
      );
      if (g !== generation.current) return;
      await refreshVersions();
      if (g !== generation.current) return;
      setVersionMsg(t.saved);
      track("sauvegarde_version");
    } catch {
      if (g === generation.current) setVersionMsg(t.saveFailed);
    } finally {
      if (g === generation.current) setVersionBusy(false);
    }
  };

  /**
   * Ouvre une version : résout d'abord de quel texte elle est faite, et refuse
   * plutôt que d'en afficher un autre. Le document lui-même est posé par le
   * Composer, à qui l'on rend le fond et la charge.
   */
  const handleLoadVersion = async (v: SavedComposition) => {
    const g = generation.current;
    setAFiger(null);
    setARejouer(null);
    const resolution = await resolveContent(v.payload.content);
    if (g !== generation.current) return;
    if (resolution.statut === "release-absente") {
      setReleaseMsg(t.releaseMissing(releaseLabel(resolution.release, locale)));
      return;
    }
    if (resolution.statut === "empreinte-divergente") {
      setReleaseMsg(t.releaseMismatch(releaseLabel(resolution.release, locale)));
      return;
    }
    if (resolution.statut === "chargement-echoue") {
      setReleaseMsg(
        t.releaseLoadFailed(releaseLabel(resolution.release, locale)),
      );
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
    const g = generation.current;
    try {
      await repinComposition(v.id, v.payload, locale);
      if (g !== generation.current) return;
      await refreshVersions();
      if (g !== generation.current) return;
      setAFiger(null);
      setReleaseMsg(null);
      onApply({
        fond: fondCourant,
        contentRef: currentContentRef(locale),
        payload: v.payload,
      });
    } catch {
      if (g === generation.current) setVersionMsg(t.versionActionFailed);
    }
  };

  /** Crée une version de celle-ci sur le texte du jour. L'originale ne bouge pas. */
  const handleMigrateVersion = async (v: SavedComposition) => {
    const nom = t.releaseMigrateName(v.name, releaseLabel(CURRENT_RELEASE, locale));
    const g = generation.current;
    try {
      const creee = await migrateComposition(v, nom, locale);
      if (g !== generation.current) return;
      await refreshVersions();
      if (g !== generation.current) return;
      setARejouer(null);
      setReleaseMsg(t.releaseMigrated(creee.name));
      onApply({
        fond: fondCourant,
        contentRef: currentContentRef(locale),
        payload: creee.payload,
      });
    } catch (error) {
      if (g !== generation.current) return;
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
    const g = generation.current;
    try {
      await renameComposition(v.id, name.trim());
      if (g !== generation.current) return;
      await refreshVersions();
    } catch {
      if (g === generation.current) setVersionMsg(t.versionActionFailed);
    }
  };

  const handleDeleteVersion = async (v: SavedComposition) => {
    if (!window.confirm(t.confirmDelete(v.name))) return;
    const g = generation.current;
    try {
      await deleteComposition(v.id);
      if (g !== generation.current) return;
      await refreshVersions();
      if (g === generation.current) setVersionMsg(null);
    } catch {
      if (g === generation.current) setVersionMsg(t.versionActionFailed);
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
    /** Un document a été posé hors d'une version : plus rien à figer ni rejouer. */
    oublierVersionOuverte: () => {
      setAFiger(null);
      setARejouer(null);
      setReleaseMsg(null);
    },
  };
}
