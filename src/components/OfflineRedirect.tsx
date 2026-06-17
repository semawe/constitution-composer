"use client";

import { useEffect } from "react";

/**
 * Page volontairement hors ligne : redirige vers `to` côté client (l'export
 * statique ne gère pas les redirections serveur). Le composant cible n'est plus
 * rendu mais reste dans le dépôt pour une remise en ligne ultérieure.
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
      <p className="text-sm text-slate-500">{message}</p>
      <a href={to} className="mt-4 text-sm text-teal-700 underline">
        {to}
      </a>
    </main>
  );
}
