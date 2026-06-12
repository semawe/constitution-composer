// Événements Umami (mesure sans cookie). No-op si le script n'est pas chargé
// (id absent au build, bloqueur, environnement de dev).

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string>) => void };
  }
}

export function track(event: string, data?: Record<string, string>) {
  try {
    window.umami?.track(event, data);
  } catch {}
}
