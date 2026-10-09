"use client";

import { useEffect } from "react";

/**
 * Adresse qui ne sert plus de contenu ici : redirige vers `to` côté client
 * (l'export statique ne porte pas de redirection serveur), en laissant le lien
 * visible pour qui a désactivé JavaScript.
 */
export default function OfflineRedirect({
  to,
  message,
}: {
  to: string;
  message: string;
}) {
  useEffect(() => {
    const id = setTimeout(() => {
      window.location.replace(to);
    }, 1200);
    return () => clearTimeout(id);
  }, [to]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted">{message}</p>
      <a href={to} className="mt-4 text-sm text-accent-text underline">
        {to}
      </a>
    </main>
  );
}
