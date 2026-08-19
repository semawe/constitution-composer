"use client";

import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import { UI } from "@/lib/i18n";
import { SEMAWE_URL, v5Href } from "@/lib/links";

const T = UI.en;

const VALUES = [
  {
    title: "Modular by design",
    body: "An irreducible core sets the shared frame. Around it, each block can be kept or removed based on what your organization actually lives.",
  },
  {
    title: "Live composition",
    body: "The Constitution rewrites itself before your eyes with every choice, without ever losing the thread of the text.",
  },
  {
    title: "Export ready to ratify",
    body: "The Constitution and the Declaration of Principles export as a PDF, branded with your organization's identity.",
  },
];

const STEPS = [
  {
    n: "1",
    t: "Start from the core",
    d: "The shared foundation of any Holacracy adoption fits in a few articles.",
  },
  {
    n: "2",
    t: "Activate your modules",
    d: "Extensions, applications, and principles unique to your organization are added as you read.",
  },
  {
    n: "3",
    t: "Export",
    d: "Your complete Constitution and a signable Declaration of Principles are ready as a PDF.",
  },
];

export default function SplashEN() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 sm:pt-24">
          <span className="cc-rise inline-block rounded-md border border-rule-strong bg-surface-subtle px-3 py-1 text-xs font-medium text-body">
            {T.unofficial}
          </span>
          <h1
            className="cc-rise cc-rise-1 mt-4 max-w-2xl font-serif text-4xl font-medium leading-tight text-strong sm:text-5xl"
          >
            Your Constitution, composed to fit
          </h1>
          <p
            className="cc-rise cc-rise-2 mt-4 max-w-xl text-lg leading-relaxed text-body"
          >
            The text starts from a battle-tested core. You activate the modules
            that fit your organization, the Constitution composes itself as you
            decide, then exports as a PDF ready to ratify.
          </p>
          <div
            className="cc-rise cc-rise-3 mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/en/composer"
              className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              Compose my Constitution →
            </Link>
            <Link
              href="/en/lite"
              className="rounded-lg border border-field px-5 py-3 text-sm font-medium text-body transition hover:bg-surface-muted"
            >
              Read the Lite version
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-rule bg-surface/40">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title}>
              <h2 className="text-base font-medium text-strong">{v.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-serif text-2xl font-medium text-strong">
          How it works
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-rule bg-surface p-6"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-text">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-medium text-strong">
                {s.t}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-body">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* L'éditeur, nommé et situé. La mention de non-officialité vit ici en
          clair, à hauteur de lecture, et non seulement en pied de page. */}
      <section className="border-t border-rule bg-surface-subtle/60">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
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
              <h2 className="font-serif text-2xl font-medium text-strong">
                {T.author.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {T.author.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <a
                  href={SEMAWE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent-text transition hover:text-teal-800"
                >
                  {T.author.semaweLink} ↗
                </a>
                <a
                  href={v5Href("en")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted transition hover:text-body"
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
            <h2 className="font-serif text-2xl font-medium text-strong">
              Ready to compose?
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-body">
              The core and the Lite model remain freely accessible. Creating an
              account unlocks extensions, applications, and PDF export.
            </p>
          </div>
          <Link
            href="/en/composer"
            className="shrink-0 rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Open the Composer →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
