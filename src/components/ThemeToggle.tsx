"use client";

import { useEffect, useState } from "react";

// Sélecteur de thème. Dark par défaut ; le choix est persisté dans localStorage
// (clé cc-theme) et appliqué avant le paint par un script inline dans layout.tsx
// pour éviter tout flash.
export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cc-theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Passer en clair" : "Passer en sombre"}
      title={dark ? "Passer en clair" : "Passer en sombre"}
      className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    >
      {dark ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M10 2.5a1 1 0 011 1V5a1 1 0 11-2 0V3.5a1 1 0 011-1zm0 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm6.5-3.5a1 1 0 01-1 1H14a1 1 0 110-2h1.5a1 1 0 011 1zM6 10a1 1 0 01-1 1H3.5a1 1 0 110-2H5a1 1 0 011 1zm8.07-4.95a1 1 0 010 1.41l-1.06 1.06a1 1 0 11-1.41-1.41l1.06-1.06a1 1 0 011.41 0zM7.4 12.6a1 1 0 010 1.41l-1.06 1.06a1 1 0 11-1.41-1.41l1.06-1.06a1 1 0 011.41 0zm6.67 1.06a1 1 0 01-1.41 1.41l-1.06-1.06a1 1 0 011.41-1.41l1.06 1.06zM7.4 7.4A1 1 0 016 8.81L4.93 7.75a1 1 0 011.41-1.41L7.4 7.4zM10 15a1 1 0 011 1v1.5a1 1 0 11-2 0V16a1 1 0 011-1z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M9.5 2a.75.75 0 01.74.9 6 6 0 007.86 6.86.75.75 0 01.96.97A7.5 7.5 0 119.5 2z" />
        </svg>
      )}
    </button>
  );
}
