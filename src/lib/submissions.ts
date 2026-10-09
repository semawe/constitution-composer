// Soumissions d'apps/extensions par les utilisateurs (App Store).
// Compte requis : pas de repli localStorage. Sans service configuré ou sans
// session, createSubmission lève une erreur explicite que l'UI traduit.

import { getService } from "./service";

export type SubmissionKind = "extension" | "app";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface AppSubmission {
  id: string;
  user_id: string;
  name: string;
  kind: SubmissionKind;
  integration_point: string | null;
  description: string;
  rationale: string | null;
  status: SubmissionStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface NewSubmission {
  name: string;
  kind: SubmissionKind;
  integrationPoint: string;
  description: string;
  rationale: string;
}

/** true si la fonctionnalité de soumission est disponible (service configuré). */
export const submissionsAvailable = getService() !== null;

/** Crée une soumission pour l'utilisateur connecté. Lève "UNAVAILABLE" ou "AUTH". */
export async function createSubmission(
  input: NewSubmission,
): Promise<AppSubmission> {
  const service = getService();
  if (!service) throw new Error("UNAVAILABLE");
  return service.creerProposition(input);
}

/** Liste les soumissions de l'utilisateur connecté (RLS : les siennes). */
export async function listMySubmissions(): Promise<AppSubmission[]> {
  const service = getService();
  if (!service) return [];
  return service.listerMesPropositions();
}
