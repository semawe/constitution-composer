"use client";

import { useEffect, useState } from "react";
import type { Service } from "@/lib/service";

// La connexion elle-même : Google, ou lien reçu par e-mail.
//
// Le Composer et la Déclaration en tenaient chacun une copie, et les deux
// ignoraient la réponse du service : un refus (quota d'envoi, fournisseur
// indisponible) affichait « lien envoyé », et la personne attendait un message
// qui n'était jamais parti (audit du 04/10/2026, F09). Une seule copie, et le
// succès ne s'annonce que sur une réponse réussie.

/** Où en est l'envoi du lien de connexion. */
export type EnvoiLien = "repos" | "encours" | "envoye" | "echec";

/**
 * L'adresse de retour d'une connexion : la page nue, celle que le service
 * d'authentification connaît. L'onglet ouvert et le geste en cours ne voyagent
 * pas par elle — ils sont retenus dans le navigateur (`@/lib/intention`).
 */
function adresseDeRetour(): string {
  return window.location.origin + window.location.pathname;
}

/**
 * Le service ramène sur la page de départ avec cette ancre quand la connexion
 * Google n'a pas abouti (refus, état expiré, jeton invalide).
 */
export const ANCRE_ECHEC_GOOGLE = "#connexion-echouee";

export function useConnexion({
  service,
  onAvantRedirection,
  onSimulee,
  onRetourEnEchec,
  retour = adresseDeRetour,
}: {
  service: Service | null;
  /** Appelé avant de quitter la page : mettre à l'abri ce qui doit survivre. */
  onAvantRedirection: () => void;
  /** Sans service, la « connexion » est un compte simulé dans le navigateur. */
  onSimulee: () => void;
  /**
   * Appelé quand la page s'ouvre au retour d'une connexion Google échouée :
   * rouvrir la connexion, pour que l'échec se lise là où on l'attend.
   */
  onRetourEnEchec?: () => void;
  /**
   * L'adresse où ramener après la connexion ; la page nue par défaut. La page
   * de confirmation d'un lien y substitue le Composer : y revenir n'aurait
   * pas de sens.
   */
  retour?: () => string;
}) {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState<EnvoiLien>("repos");
  const [googleEchec, setGoogleEchec] = useState(false);

  // Retour de Google en échec : l'ancre est lue une fois, puis retirée de
  // l'adresse (un rechargement ne doit pas redire un échec ancien).
  useEffect(() => {
    if (!service || window.location.hash !== ANCRE_ECHEC_GOOGLE) return;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    // Lu dans l'adresse après montage : le rendu prérendu ne le connaît pas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoogleEchec(true);
    onRetourEnEchec?.();
    // Une seule lecture, au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  const signInGoogle = async () => {
    if (!service) {
      onSimulee();
      return;
    }
    setGoogleEchec(false);
    onAvantRedirection();
    try {
      const { ok } = await service.partirChezGoogle(retour());
      if (!ok) setGoogleEchec(true);
    } catch {
      setGoogleEchec(true);
    }
  };

  const signInOtp = async () => {
    const adresse = email.trim();
    // Un envoi déjà parti ne se double pas : le bouton est désactivé, mais la
    // touche Entrée ou un double clic arrivent avant le rendu suivant.
    if (!adresse || envoi === "encours") return;
    if (!service) {
      onSimulee();
      return;
    }
    setEnvoi("encours");
    onAvantRedirection();
    try {
      const { ok } = await service.demanderLien(adresse, retour());
      setEnvoi(ok ? "envoye" : "echec");
    } catch {
      setEnvoi("echec");
    }
  };

  return {
    email,
    setEmail: (v: string) => {
      setEmail(v);
      // Corriger l'adresse après un refus efface le refus : il portait sur
      // l'envoi précédent.
      if (envoi === "echec") setEnvoi("repos");
    },
    envoi,
    googleEchec,
    signInGoogle,
    signInOtp,
  };
}

export type Connexion = ReturnType<typeof useConnexion>;
