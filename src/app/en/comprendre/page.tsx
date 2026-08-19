import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Understanding the Holacracy Constitution",
  description:
    "What the Holacracy Constitution is, how to adopt it in modular form, and frequently asked questions about the Sémawé edition.",
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
    q: "Is the text offered here the official Constitution?",
    a: "No. HolacracyOne publishes the official Constitution, currently version 5.0. The text offered here is a Sémawé edition derived from that 5.0: it exists to explore reductions and additions the official text does not carry. To adopt the reference version, HolacracyOne is authoritative.",
  },
  {
    q: "How does this relate to HolacracyOne's own tool?",
    a: "HolacracyOne offers its own composer on the official 5.0 Constitution. The two tools coexist without overlapping: this one works on stratification (Micro, Lite, Full) and on extensions that 5.0 does not provide for.",
  },
];

export default function ComprendrePageEN() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Documentation
          </p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-medium leading-tight text-strong sm:text-5xl">
            Understanding the Constitution
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-body">
            The Holacracy Constitution defines the rules of the game. It is not
            a set of values or intentions, but a formal authority structure that
            replaces the traditional management hierarchy.
          </p>
        </div>

        {/* Same editorial template as the French page: the question carries
            the display type, the number holds the margin, a rule separates
            entries. */}
        <section className="mt-16">
          <h2 className="font-serif text-2xl font-medium text-strong">
            Frequently asked questions
          </h2>
          <dl className="mt-8 border-t border-rule">
            {QA.map(({ q, a }, i) => (
              <div
                key={q}
                className="grid gap-x-8 gap-y-3 border-b border-rule py-8 sm:grid-cols-[3rem_1fr]"
              >
                <dt className="font-serif text-lg leading-snug text-muted sm:text-right">
                  {String(i + 1).padStart(2, "0")}
                </dt>
                <div>
                  <dt className="font-serif text-xl leading-snug text-strong">
                    {q}
                  </dt>
                  <dd className="mt-3 max-w-2xl leading-relaxed text-body">
                    {a}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 max-w-2xl rounded-xl border border-accent-border bg-accent-soft p-6">
          <h2 className="font-medium text-accent-strong">Try the Composer</h2>
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
            className="text-sm font-medium text-muted hover:text-body"
          >
            ← Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
