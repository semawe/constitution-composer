"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { type Locale, getLocaleFromPath, toOtherLocale, UI } from "@/lib/i18n";
import { HETEROSTASIA_URL, SEMAWE_URL, v5Href } from "@/lib/links";
import { buildLabel } from "@/lib/build-info";

function navHref(base: string, locale: Locale) {
  return locale === "en" ? `/en${base}` : base;
}

export function SiteNav({ locale: localeProp }: { locale?: Locale }) {
  const pathname = usePathname();
  const locale = localeProp ?? getLocaleFromPath(pathname);
  const t = UI[locale].nav;
  const brand = UI[locale].brand;
  const otherLocale = locale === "fr" ? "en" : "fr";
  const otherPath = toOtherLocale(pathname);

  const NAV = [
    { href: navHref("/composer", locale), label: t.composer },
    { href: navHref("/micro", locale), label: t.micro },
    { href: navHref("/lite", locale), label: t.lite },
    { href: navHref("/comprendre", locale), label: t.comprendre },
  ];

  return (
    <header className="sticky top-0 z-40 border-b rule-hairline bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Co-marquage : le produit porte sa marque, et l'éditeur est nommé dès
            l'en-tête plutôt qu'au seul pied de page. Le logo Sémawé est une
            ancre distincte — imbriquer deux liens serait du HTML invalide. */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={locale === "en" ? "/en" : "/"}
            className="flex items-center gap-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-sm text-white">
              ⬡
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-slate-800">
                {brand.product}
              </span>
              <span className="text-[0.65rem] text-slate-400">
                {brand.byline}
              </span>
            </span>
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-slate-200 sm:block" />
          <a
            href={SEMAWE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={brand.semaweAlt}
            className="hidden shrink-0 sm:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-semawe-light.png"
              alt={brand.semaweAlt}
              className="h-5 w-auto dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-semawe-dark.png"
              alt={brand.semaweAlt}
              className="hidden h-5 w-auto dark:block"
            />
          </a>
        </div>
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
    <footer className="border-t rule-hairline bg-background">
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
            <Link
              href={navHref("/mentions-legales", locale)}
              className="transition hover:text-slate-800"
            >
              {t.legal}
            </Link>
          </div>
        </div>
        <p className="border-t rule-hairline pt-4 text-xs text-slate-400">
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
        {/* `text-slate-300` : 1,4:1 sur le fond clair, illisible. La version
            du build est une information, pas une décoration. */}
        <p className="text-[0.7rem] text-slate-500">{buildLabel}</p>
      </div>
    </footer>
  );
}
