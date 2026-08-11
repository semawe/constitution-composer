// Périmètre admin de l'écran /admin.
//
// Le droit vient d'un seul endroit : le claim `admin` dans `app_metadata`,
// porté par le JWT Supabase. `app_metadata` n'est modifiable qu'avec la clé
// service_role — contrairement à `user_metadata`, que l'utilisateur contrôle.
// La même expression protège la lecture des tables côté base (`public.is_admin()`,
// migration `0007_admin_claim.sql`) : le front et la RLS ne peuvent plus
// diverger. Qui obtient le claim se décide dans `private.admin_emails`.
//
// Ce gating front n'est toujours qu'un affichage : la vraie barrière est la RLS.

export interface AdminClaimCarrier {
  app_metadata?: Record<string, unknown> | null;
}

export function isAdminUser(user?: AdminClaimCarrier | null): boolean {
  return user?.app_metadata?.admin === true;
}
