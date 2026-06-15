"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/composer", label: "Composer" },
  { href: "/cartographie", label: "Cartographie" },
  { href: "/comprendre", label: "Comprendre" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-sm text-white">
            ⬡
          </span>
          <span className="text-sm font-medium text-slate-800">
            Constitution Composer
          </span>
        </Link>
        <div className="flex items-center gap-1 text-sm text-slate-500 sm:gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-800 sm:inline"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/composer"
            className="rounded-lg border border-teal-600 px-3 py-1.5 text-teal-700 transition hover:bg-teal-50"
          >
            Se connecter
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Constitution Composer, un outil Sémawé.</span>
        <div className="flex gap-4">
          <Link href="/comprendre" className="transition hover:text-slate-800">
            Comprendre
          </Link>
          <Link href="/cartographie" className="transition hover:text-slate-800">
            Cartographie
          </Link>
          <Link href="/composer" className="transition hover:text-slate-800">
            Composer
          </Link>
        </div>
      </div>
    </footer>
  );
}
