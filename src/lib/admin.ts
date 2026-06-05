// Périmètre admin de l'écran /admin. La même liste est répliquée dans la
// fonction SQL public.is_admin() (migration Phase B) qui protège la lecture
// côté base via RLS. Garder les deux synchronisées.

export const ADMIN_EMAILS = ["contact@semawe.fr", "admin@example.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
