// Sauvegarde des compositions (Phase B). Backend Supabase quand il est
// configuré et l'utilisateur connecté ; sinon repli localStorage (compte
// simulé / dev sans clés). Plafond ≤5 appliqué côté app ET côté base (trigger).

import { getSupabase } from "./supabase";

export interface CompositionPayload {
  title: string;
  values: string;
  active: string[]; // ids des blocs retirables / modules cochés
  titleColor?: string; // couleur du titre choisie (hex), vide = défaut du thème
  font?: string; // clé de la police du document (cf. FONT_OPTIONS)
  logo?: string; // logo de l'organisation, en data URL (redimensionné)
}

export interface SavedComposition {
  id: string;
  name: string;
  payload: CompositionPayload;
  updated_at: string;
}

export const MAX_COMPOSITIONS = 5;

const LS_KEY = "cc_versions";

function lsRead(): SavedComposition[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SavedComposition[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(rows: SavedComposition[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {}
}

const SELECT = "id,name,payload,updated_at";

export async function listCompositions(): Promise<SavedComposition[]> {
  const sb = getSupabase();
  if (!sb) return lsRead();
  const { data, error } = await sb
    .from("compositions")
    .select(SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedComposition[];
}

export async function saveComposition(
  name: string,
  payload: CompositionPayload,
): Promise<SavedComposition> {
  const sb = getSupabase();
  if (!sb) {
    const rows = lsRead();
    if (rows.length >= MAX_COMPOSITIONS) throw new Error("LIMIT");
    const row: SavedComposition = {
      id: crypto.randomUUID(),
      name,
      payload,
      updated_at: new Date().toISOString(),
    };
    lsWrite([row, ...rows]);
    return row;
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("AUTH");
  const { data, error } = await sb
    .from("compositions")
    .insert({ user_id: user.id, name, payload })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as SavedComposition;
}

export async function renameComposition(
  id: string,
  name: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    lsWrite(lsRead().map((r) => (r.id === id ? { ...r, name } : r)));
    return;
  }
  const { error } = await sb
    .from("compositions")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteComposition(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    lsWrite(lsRead().filter((r) => r.id !== id));
    return;
  }
  const { error } = await sb.from("compositions").delete().eq("id", id);
  if (error) throw error;
}
