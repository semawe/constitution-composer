"use client";

import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import { UI } from "@/lib/i18n";
import { SEMAWE_URL, v5Href } from "@/lib/links";

const T = UI.fr;

const VALUES = [
  {
    title: "Modules à la carte",
    body: "Un socle incompressible pose le cadre commun. Autour de lui, chaque bloc se conserve ou se retire selon ce que vit votre organisation.",
  },
  {
    title: "Composition en direct",
    body: "La Constitution se réécrit sous vos yeux à chaque choix, sans jamais quitter le fil du texte.",
  },
  {
    title: "Export prêt à ratifier",
    body: "La Constitution et la Déclaration de Principes s'exportent en PDF, à l'identité de votre organisation.",
  },
];

const STEPS = [
  {
    n: "1",
    t: "Partez du socle",
    d: "Le cœur commun à toute adoption d'Holacracy tient en quelques articles.",
  },
  {
    n: "2",
    t: "Activez vos modules",
    d: "Extensions, applications et principes propres à votre organisation s'ajoutent au fil de la lecture.",
  },
  {
    n: "3",
    t: "Exportez",
    d: "La Constitution complète et une Déclaration de Principes signable vous attendent en PDF.",
  },
];

export default function Splash() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 bottom-0 hidden w-80 rotate-[-3deg] opacity-[0.13] sm:block"
        >
          <div className="rounded-xl border border-rule-strong bg-white p-4">
            <div className="mb-3 h-2.5 w-3/5 rounded bg-slate-300" />
            {[true, true, false, true].map((on, i) => (
              <div key={i} className="mb-2.5 flex items-center gap-2">
                <span
                  className={`h-4 w-4 rounded ${on ? "bg-teal-600" : "border border-slate-400"}`}
                />
                <span className="h-2 flex-1 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 sm:pt-24">
          <span className="cc-rise inline-block rounded-md border border-rule-strong bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {T.unofficial}
          </span>
          <h1
            className="cc-rise cc-rise-1 mt-4 max-w-2xl font-serif text-4xl font-medium leading-tight text-slate-900 sm:text-5xl"
          >
            Votre Constitution, composée à la carte
          </h1>
          <p
            className="cc-rise cc-rise-2 mt-4 max-w-xl text-lg leading-relaxed text-slate-600"
          >
            Le texte part d&apos;un socle éprouvé. Vous activez les modules qui
            correspondent à votre organisation, la Constitution se compose à
            mesure que vous décidez, puis s&apos;exporte en PDF prêt à ratifier.
          </p>
          <div
            className="cc-rise cc-rise-3 mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/composer"
              className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              Composer ma Constitution →
            </Link>
            <Link
              href="/lite"
              className="rounded-lg border border-field px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Lire la version Lite
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-rule bg-slate-50/60 dark:bg-slate-800/20">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title}>
              <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">{v.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-serif text-2xl font-medium text-slate-900">
          Comment ça marche
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            // Pas de `dark:border-*` ici : la déclaration était morte, le
            // remappage global la coiffait, et `border-rule` porte désormais la
            // couleur des deux thèmes. La garder ferait deux sources de vérité
            // pour un même bord, à deux unités près — et `SplashEN` ne l'avait
            // pas, donc les deux versions divergeaient déjà en thème sombre.
            <div
              key={s.n}
              className="rounded-xl border border-rule bg-white p-6 dark:bg-slate-800/40"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-medium text-teal-700">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-medium text-slate-900 dark:text-slate-100">
                {s.t}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* L'éditeur, nommé et situé. La mention de non-officialité vit ici en
          clair, à hauteur de lecture, et non seulement en pied de page. */}
      <section className="border-t border-rule bg-slate-50/60 dark:bg-slate-800/20">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {T.author.kicker}
          </p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
            <a
              href={SEMAWE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-semawe-light.png"
                alt={T.brand.semaweAlt}
                className="h-14 w-auto dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-semawe-dark.png"
                alt={T.brand.semaweAlt}
                className="hidden h-14 w-auto dark:block"
              />
            </a>
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl font-medium text-slate-900">
                {T.author.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {T.author.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <a
                  href={SEMAWE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 transition hover:text-teal-800"
                >
                  {T.author.semaweLink} ↗
                </a>
                <a
                  href={v5Href("fr")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 transition hover:text-slate-800"
                >
                  {T.footer.v5Label} ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-medium text-slate-900">
              Prêt à composer ?
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              Le cœur et le modèle Lite restent en accès libre. La création
              d&apos;un compte ouvre les extensions, les applications et
              l&apos;export PDF.
            </p>
          </div>
          <Link
            href="/composer"
            className="shrink-0 rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Ouvrir le composer →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
