// Sauvegarde des compositions (Phase B). Backend Supabase quand il est
// configuré et l'utilisateur connecté ; sinon repli localStorage (compte
// simulé / dev sans clés). Plafond ≤5 appliqué côté app ET côté base (trigger).

import { getSupabase } from "./supabase";
import { type ContentRef, type Locale, currentContentRef } from "./releases";

export interface CompositionPayload {
  /**
   * 2 depuis l'archivage des releases du fond. Absent = composition d'avant,
   * dont on ne peut rien garantir : elle n'est figée sur aucun texte.
   */
  schemaVersion?: 2;
  /**
   * Le fond dont cette composition est issue. C'est ce champ qui fait d'une
   * version un document plutôt qu'une configuration : sans lui, la rouvrir
   * après une retouche éditoriale rend un autre texte sous le même nom.
   */
  content?: ContentRef;
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

/**
 * L'estampille se pose ici, à la frontière : aucun appelant ne peut sauvegarder
 * une composition sans dire de quel texte elle vient.
 */
export async function saveComposition(
  name: string,
  payload: CompositionPayload,
  locale: Locale,
): Promise<SavedComposition> {
  payload = {
    ...payload,
    schemaVersion: 2,
    content: currentContentRef(locale),
  };
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

/**
 * Fige une composition existante sur le texte du jour, en place.
 *
 * Surtout pas « enregistrer puis supprimer » : au plafond de cinq versions, la
 * création échoue et la personne perd son geste sans comprendre ; et si la
 * suppression échoue après une création réussie, elle se retrouve avec un
 * doublon. Une mise à jour ne peut ni dépasser le plafond ni dédoubler.
 */
export async function repinComposition(
  id: string,
  payload: CompositionPayload,
  locale: Locale,
): Promise<void> {
  const fige: CompositionPayload = {
    ...payload,
    schemaVersion: 2,
    content: currentContentRef(locale),
  };
  const sb = getSupabase();
  if (!sb) {
    lsWrite(
      lsRead().map((r) => (r.id === id ? { ...r, payload: fige } : r)),
    );
    return;
  }
  const { error } = await sb
    .from("compositions")
    .update({ payload: fige, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
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
