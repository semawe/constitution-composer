// Périmètre admin de l'écran /admin. La liste vient de l'environnement
// (NEXT_PUBLIC_ADMIN_EMAILS, séparée par des virgules) et doit rester
// synchronisée avec la fonction SQL public.is_admin() qui protège la lecture
// côté base via RLS. Le gating front n'est qu'un affichage : la vraie barrière
// est la RLS Supabase.

export const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
