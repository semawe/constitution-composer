"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { type Locale, getLocaleFromPath, toOtherLocale, UI } from "@/lib/i18n";
import { HETEROSTASIA_URL, SEMAWE_URL, v5Href } from "@/lib/links";

function navHref(base: string, locale: Locale) {
  return locale === "en" ? `/en${base}` : base;
}

export function SiteNav({ locale: localeProp }: { locale?: Locale }) {
  const pathname = usePathname();
  const locale = localeProp ?? getLocaleFromPath(pathname);
  const t = UI[locale].nav;
  const otherLocale = locale === "fr" ? "en" : "fr";
  const otherPath = toOtherLocale(pathname);

  const NAV = [
    { href: navHref("/composer", locale), label: t.composer },
    { href: navHref("/micro", locale), label: t.micro },
    { href: navHref("/lite", locale), label: t.lite },
    { href: navHref("/comprendre", locale), label: t.comprendre },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={locale === "en" ? "/en" : "/"} className="flex items-center gap-2">
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
            href={navHref("/composer", locale)}
            className="rounded-lg border border-teal-600 px-3 py-1.5 text-teal-700 transition hover:bg-teal-50"
          >
            {t.login}
          </Link>
          {/* Language switcher */}
          <Link
            href={otherPath}
            className="rounded-full px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title={otherLocale === "en" ? "English version" : "Version française"}
          >
            {otherLocale.toUpperCase()}
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter({ locale: localeProp }: { locale?: Locale }) {
  const pathname = usePathname();
  const locale = localeProp ?? getLocaleFromPath(pathname);
  const t = UI[locale].footer;

  return (
    <footer className="border-t border-slate-200 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-sm text-slate-500">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>{t.tagline}</span>
          <div className="flex flex-wrap gap-4">
            <Link href={navHref("/micro", locale)} className="transition hover:text-slate-800">
              {UI[locale].nav.micro}
            </Link>
            <Link href={navHref("/lite", locale)} className="transition hover:text-slate-800">
              {UI[locale].nav.lite}
            </Link>
            <Link href={navHref("/comprendre", locale)} className="transition hover:text-slate-800">
              {UI[locale].nav.comprendre}
            </Link>
            <Link href={navHref("/composer", locale)} className="transition hover:text-slate-800">
              {UI[locale].nav.composer}
            </Link>
            <a
              href={v5Href(locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-slate-800"
            >
              {t.v5Label} ↗
            </a>
          </div>
        </div>
        <p className="border-t border-slate-200 pt-4 text-xs text-slate-400">
          {t.createdByPre}{" "}
          <a
            href={HETEROSTASIA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 underline transition hover:text-slate-700"
          >
            Heterostasia
          </a>
          {t.createdByMid}{" "}
          <a
            href={SEMAWE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 underline transition hover:text-slate-700"
          >
            Sémawé
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
