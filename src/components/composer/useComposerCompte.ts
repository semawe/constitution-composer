"use client";

import { useEffect, useState } from "react";
import type { Compte, Service } from "@/lib/service";
import { track } from "@/lib/analytics";
import { useConnexion } from "@/components/compte/useConnexion";

// Le compte : session, portes (le « mur » du freemium), connexion Google ou par
// lien, onboarding de l'entreprise, déconnexion.
//
// Sorti de `Composer.tsx` (tâche #1057). Le repli sans service — compte simulé
// dans le navigateur — vit ici aussi : c'est le même sujet, et le laisser en
// travers du composant était une des raisons de sa taille.

export type Porte = "pdf" | "save" | "modules" | "account" | null;

/** L'identité du compte simulé : il n'y en a qu'un par navigateur. */
const IDENTITE_SIMULEE = "local";

export function useComposerCompte({
  service,
  onAvantRedirection,
  onConnexionSimulee,
}: {
  service: Service | null;
  /**
   * Appelé avant qu'une connexion quitte la page, avec la porte qui l'a
   * demandée : le brouillon et le geste en cours sont mis à l'abri.
   */
  onAvantRedirection: (raison: Porte) => void;
  /** Sans service, la « connexion » est immédiate : on reprend le geste demandé. */
  onConnexionSimulee: (raison: Porte) => void;
}) {
  const [account, setAccount] = useState(false);
  const [user, setUser] = useState<Compte | null>(null);
  // La session est lue après le montage, et de façon asynchrone. Tant qu'elle
  // ne l'est pas, « pas de compte » ne veut rien dire : c'est ce drapeau qui
  // distingue « personne n'est connecté » de « on ne sait pas encore ».
  const [sessionConnue, setSessionConnue] = useState(false);
  const [needsCompany, setNeedsCompany] = useState(false);
  const [company, setCompany] = useState("");
  const [companyEchec, setCompanyEchec] = useState(false);
  const [gate, setGate] = useState<Porte>(null);

  useEffect(() => {
    if (!service) {
      /* eslint-disable react-hooks/set-state-in-effect */
      try {
        // repli compte simulé lu dans localStorage après montage.
        if (localStorage.getItem("cc_account") === "1") setAccount(true);
      } catch {}
      setSessionConnue(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const apply = (u: Compte | null) => {
      setUser(u);
      setAccount(!!u);
      setNeedsCompany(!!u && !u.organisation);
      setSessionConnue(true);
      // Miroir du compte côté service : rattachement et notification Slack à la
      // première organisation renseignée. Sans attente : il ne bloque rien.
      if (u) service.rattacherProfil(u).catch(() => {});
    };
    service.lireSession().then(apply);
    return service.ecouterSession((compte, evenement) => {
      if (evenement === "connexion") track("connexion");
      apply(compte);
    });
  }, [service]);

  const connexion = useConnexion({
    service,
    onAvantRedirection: () => onAvantRedirection(gate),
    // Retour de Google en échec : la connexion se rouvre, l'échec s'y lit.
    onRetourEnEchec: () => setGate((g) => g ?? "account"),
    // Connexion Google réelle (service). Sans service → compte simulé (repli).
    onSimulee: () => {
      setAccount(true);
      try {
        localStorage.setItem("cc_account", "1");
      } catch {}
      const raison = gate;
      setGate(null);
      onConnexionSimulee(raison);
    },
  });

  // Onboarding : Google ne fournit pas l'entreprise → on la collecte une fois.
  // La boîte ne se referme que si l'écriture a réussi : la fermer d'office
  // faisait croire l'organisation enregistrée (audit du 04/10/2026, F09).
  const submitCompany = async () => {
    if (!service || !company.trim()) return;
    setCompanyEchec(false);
    try {
      const { ok } = await service.enregistrerOrganisation(company.trim());
      if (!ok) {
        setCompanyEchec(true);
        return;
      }
      setNeedsCompany(false);
    } catch {
      setCompanyEchec(true);
    }
  };

  // La chrome du Composer (App.tsx) peut demander l'ouverture de la connexion
  // via un événement, sans remonter tout l'état d'auth.
  useEffect(() => {
    const open = () => setGate((g) => g ?? "account");
    window.addEventListener("cc:open-signin", open);
    return () => window.removeEventListener("cc:open-signin", open);
  }, []);

  const signOut = async () => {
    if (service) {
      // Le port force la sortie locale si le service ne répond pas. Et quoi
      // qu'il arrive, l'application se tient pour sortie : c'est sur l'identité
      // tombée à null que se purgent le document, le brouillon et les versions.
      await service.sortir().catch(() => {});
      setUser(null);
      setAccount(false);
      setNeedsCompany(false);
    } else {
      setAccount(false);
      try {
        localStorage.removeItem("cc_account");
      } catch {}
    }
  };

  /**
   * Qui est là : l'identifiant du compte, ou null. C'est sur lui, et non sur un
   * simple « connecté ou pas », que se règlent la liste des versions, le
   * brouillon et le document affiché — passer d'un compte à un autre sans
   * repasser par « déconnecté » laisse le booléen à vrai (audit, F06).
   */
  const identite: string | null =
    user?.id ?? (account && !service ? IDENTITE_SIMULEE : null);

  return {
    account,
    user,
    identite,
    sessionConnue,
    gate,
    setGate,
    connexion,
    needsCompany,
    setNeedsCompany,
    company,
    setCompany,
    companyEchec,
    submitCompany,
    signOut,
  };
}
