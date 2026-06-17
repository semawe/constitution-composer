// Soumissions d'apps/extensions par les utilisateurs (App Store).
// Compte requis : pas de repli localStorage. Sans Supabase configuré ou sans
// session, createSubmission lève une erreur explicite que l'UI traduit.

import { getSupabase } from "./supabase";

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

const SELECT =
  "id,user_id,name,kind,integration_point,description,rationale,status,admin_note,created_at,reviewed_at";

/** true si la fonctionnalité de soumission est disponible (Supabase configuré). */
export const submissionsAvailable = getSupabase() !== null;

/** Crée une soumission pour l'utilisateur connecté. Lève "UNAVAILABLE" ou "AUTH". */
export async function createSubmission(
  input: NewSubmission,
): Promise<AppSubmission> {
  const sb = getSupabase();
  if (!sb) throw new Error("UNAVAILABLE");
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("AUTH");
  const { data, error } = await sb
    .from("app_submissions")
    .insert({
      user_id: user.id,
      name: input.name,
      kind: input.kind,
      integration_point: input.integrationPoint || null,
      description: input.description,
      rationale: input.rationale || null,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as AppSubmission;
}

/** Liste les soumissions de l'utilisateur connecté (RLS : les siennes). */
export async function listMySubmissions(): Promise<AppSubmission[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from("app_submissions")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppSubmission[];
}

/** Liste toutes les soumissions (admin, via RLS is_admin). */
export async function listAllSubmissions(): Promise<AppSubmission[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("app_submissions")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppSubmission[];
}

/** Met à jour le statut d'une soumission (admin). */
export async function reviewSubmission(
  id: string,
  status: SubmissionStatus,
  adminNote: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("UNAVAILABLE");
  const { error } = await sb
    .from("app_submissions")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
