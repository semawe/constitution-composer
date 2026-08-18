// Client Supabase : auth (Google OAuth) + collecte de leads.
// Graceful : tant que les variables d'env ne sont pas définies, getSupabase()
// renvoie null et l'app reste sur le compte simulé (stub Lot 2). Dès que
// NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY sont fournies (au
// build), l'auth réelle s'active automatiquement.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Un build de production sans clés basculait en silence sur le compte simulé et
// `localStorage` : le site paraissait marcher, annonçait des sauvegardes, et les
// données ne suivaient pas le compte. Le repli reste possible, mais il se
// demande — il ne s'obtient plus par l'absence d'un secret.
if (
  !(url && anon) &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE !== "true"
) {
  throw new Error(
    "Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY). Un build de production sans compte réel " +
      "doit être demandé explicitement : NEXT_PUBLIC_ALLOW_DEMO_MODE=true.",
  );
}

let client: SupabaseClient | null = null;
if (url && anon) {
  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/** Le client, ou null si Supabase n'est pas (encore) configuré. */
export function getSupabase(): SupabaseClient | null {
  return client;
}

/** true si les clés Supabase sont présentes (auth réelle disponible). */
export const supabaseConfigured = client !== null;
