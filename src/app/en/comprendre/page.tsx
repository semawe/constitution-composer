import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Understanding the Holacracy Constitution",
  description:
    "What the Holacracy Constitution is, how to adopt it in modular form, and frequently asked questions.",
  alternates: {
    canonical: "https://constitution-composer.com/en/comprendre",
    languages: { fr: "https://constitution-composer.com/comprendre" },
  },
};

const QA = [
  {
    q: "What is the Holacracy Constitution?",
    a: "The reference document that sets the rules of the game for a Holacracy organization: a shared core, modules, and principles that each organization adopts.",
  },
  {
    q: "What does 'modular' mean?",
    a: "You start from an irreducible core, then activate or remove blocks, extensions, and applications based on what your organization needs.",
  },
  {
    q: "What is the PDF export for?",
    a: "To have a Constitution ready to ratify, and a Declaration of Principles signable by the ratifiers.",
  },
  {
    q: "What is the difference between v5.0 and v6?",
    a: "Version 5.0 is the last official release by HolacracyOne. Version 6 (alpha) is a work in progress with structural simplifications. The English Composer uses v5.0; the French Composer uses v6 alpha.",
  },
];

export default function ComprendrePageEN() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Documentation
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-slate-900">
            Understanding the Constitution
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            The Holacracy Constitution defines the rules of the game. It is not
            a set of values or intentions, but a formal authority structure that
            replaces the traditional management hierarchy.
          </p>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-medium text-slate-900">
            Frequently asked questions
          </h2>
          <dl className="mt-6 space-y-6">
            {QA.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-slate-200 bg-white p-6">
                <dt className="font-medium text-slate-900">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-xl border border-teal-200 bg-teal-50 p-6">
          <h2 className="font-medium text-teal-900">Try the Composer</h2>
          <p className="mt-2 text-sm leading-relaxed text-teal-800">
            The core and the Lite model are freely accessible. Compose your
            Constitution and export a ratification-ready PDF.
          </p>
          <Link
            href="/en/composer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800"
          >
            Open the Composer →
          </Link>
        </section>

        <div className="mt-10">
          <Link
            href="/en"
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            ← Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
