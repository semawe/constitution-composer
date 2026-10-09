// Le port de service : tout ce que l'application demande au backend des
// comptes, et rien d'autre.
//
// Les composants ne parlent qu'à ce port. Derrière lui, l'un de deux
// adaptateurs, choisi au build (`./backend.ts`) : le service des comptes de
// l'instance Sémawé (`./service-http.ts`, même origine, sous « api »), ou
// Supabase (`./supabase.ts`, seul fichier autorisé à importer la bibliothèque)
// tant que la production en dépend. Sans backend, `getService()` rend null et
// l'application tourne sur le compte simulé du navigateur.

import type { CompositionPayload, SavedComposition } from "./compositions";
import type { DeclarationPayload } from "./declaration";
import type { Reponse } from "./declaration-sync";
import type { AppSubmission, NewSubmission } from "./submissions";
import { BACKEND_CHOISI, exigerBackendEnProduction } from "./backend";
import { creerServiceHttp } from "./service-http";
import { creerServiceSupabase } from "./supabase";

/** Le compte connecté, tel que l'application en a besoin. */
export interface Compte {
  id: string;
  email: string | null;
  /** Nom complet, quand le fournisseur d'identité le donne. */
  nom: string | null;
  /** Prénom, quand le fournisseur d'identité le donne. */
  prenom: string | null;
  /** L'organisation déclarée par la personne, ou null tant qu'elle ne l'a pas dit. */
  organisation: string | null;
}

/**
 * Ce qui vient d'arriver à la session : une connexion qui aboutit, une sortie,
 * ou autre chose (relecture, rafraîchissement, profil modifié).
 */
export type EvenementSession = "connexion" | "deconnexion" | "autre";

/** La Déclaration telle que le compte la porte. */
export interface DeclarationDistante {
  payload: unknown;
  revision: number;
}

export interface Service {
  // Session
  lireSession(): Promise<Compte | null>;
  /** S'abonne aux changements de session ; rend la fonction de désabonnement. */
  ecouterSession(
    ecouteur: (compte: Compte | null, evenement: EvenementSession) => void,
  ): () => void;

  // Connexion. Chaque demande dit si le service l'a acceptée ; une panne du
  // réseau se traduit par une exception.
  /**
   * Envoie un lien de connexion à `email`, qui ramènera sur `retour`.
   * `infolettre` : la case des nouvelles est cochée ; l'accord ne vaut qu'à la
   * connexion réussie (tâche ERP 846).
   */
  demanderLien(email: string, retour: string, infolettre?: boolean): Promise<{ ok: boolean }>;
  /** Part chez Google ; le retour se fait sur `retour`. Même `infolettre`. */
  partirChezGoogle(retour: string, infolettre?: boolean): Promise<{ ok: boolean }>;
  /**
   * Sort. Si le service ne répond pas, la sortie locale est forcée : sur un
   * poste partagé, c'est elle qui compte. Ne lève jamais.
   */
  sortir(): Promise<void>;

  // Profil
  /**
   * Tient à jour le miroir du compte côté service (rattachement, notification
   * de la première organisation). Sans effet si le service le tient seul.
   */
  rattacherProfil(compte: Compte): Promise<void>;
  /** Enregistre l'organisation du compte connecté. */
  enregistrerOrganisation(organisation: string): Promise<{ ok: boolean }>;

  // Versions de la Constitution
  listerVersions(): Promise<SavedComposition[]>;
  /** Lève « AUTH » sans session. */
  creerVersion(
    nom: string,
    payload: CompositionPayload,
  ): Promise<SavedComposition>;
  renommerVersion(id: string, nom: string): Promise<void>;
  /** Remplace la charge d'une version, en place. */
  remplacerVersion(id: string, payload: CompositionPayload): Promise<void>;
  supprimerVersion(id: string): Promise<void>;

  // Déclaration de Principes
  /** La Déclaration du compte, ou null s'il n'en a pas. Lève en cas d'erreur. */
  lireDeclaration(compte: string): Promise<DeclarationDistante | null>;
  /**
   * Propose la révision `revision`. `compte` est celui pour lequel la charge a
   * été préparée : le service refuse si la session en porte un autre.
   */
  ecrireDeclaration(
    payload: DeclarationPayload,
    revision: number,
    compte: string,
  ): Promise<Reponse>;

  // Propositions d'apps
  /** Lève « AUTH » sans session. */
  creerProposition(input: NewSubmission): Promise<AppSubmission>;
  /** Les propositions du compte connecté ; liste vide sans session. */
  listerMesPropositions(): Promise<AppSubmission[]>;
}

exigerBackendEnProduction(BACKEND_CHOISI, {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_ALLOW_DEMO_MODE: process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE,
});

// La première condition porte sur la variable telle que Next la remplace au
// build : dans un build « serveur », la branche Supabase est du code mort, et
// la bibliothèque peut sortir du bundle.
const service: Service | null =
  process.env.NEXT_PUBLIC_BACKEND === "serveur"
    ? creerServiceHttp()
    : BACKEND_CHOISI.type === "supabase"
      ? creerServiceSupabase(BACKEND_CHOISI.url, BACKEND_CHOISI.cle)
      : null;

/** Le service, ou null si aucun backend n'est configuré (compte simulé). */
export function getService(): Service | null {
  return service;
}

/** true si un backend de comptes est disponible. */
export const serviceConfigure = service !== null;
