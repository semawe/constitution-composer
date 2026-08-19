// Coachs proposés à la réservation (pages Google Agenda, créneaux d'initiation).
// Aucune donnée nominative dans le code : la liste vient de l'environnement,
// NEXT_PUBLIC_COACHES = tableau JSON [{ "name": "...", "url": "..." }, …].
// Pour l'instance Sémawé, source de vérité = base Notion « Coachs — plannings
// Google RDV ». Liste vide → la réservation de coaching est masquée.
export type Coach = { name: string; url: string };
export const COACHES: Coach[] = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_COACHES;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.name === "string" && typeof c.url === "string")
      : [];
  } catch {
    return [];
  }
})();
