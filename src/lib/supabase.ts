// Client Supabase : auth (Google OAuth) + collecte de leads.
// Graceful : tant que les variables d'env ne sont pas définies, getSupabase()
// renvoie null et l'app reste sur le compte simulé (stub Lot 2). Dès que
// NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY sont fournies (au
// build), l'auth réelle s'active automatiquement.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
