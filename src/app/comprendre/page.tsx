import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Comprendre la Constitution Holacracy",
  description:
    "Ce qu'est la Constitution Holacracy, comment l'adopter à la carte, et les questions fréquentes sur l'édition Sémawé.",
};

const QA = [
  {
    q: "Qu'est-ce que la Constitution Holacracy ?",
    a: "Le texte de référence qui fixe les règles du jeu d'une organisation en Holacracy : un socle commun, des modules et des principes que chaque organisation adopte.",
  },
  {
    q: "Que veut dire « à la carte » ?",
    a: "On part d'un cœur incompressible, puis on active ou on retire des blocs, des extensions et des applications selon ce dont l'organisation a besoin.",
  },
  {
    q: "À quoi sert l'export PDF ?",
    a: "À disposer d'une Constitution prête à ratifier, et d'une Déclaration de Principes signable par les ratificateurs.",
  },
  {
    q: "Le texte proposé ici est-il la Constitution officielle ?",
    a: "Non. HolacracyOne publie la Constitution officielle, dont la dernière version est la 5.0. Le texte proposé ici est une édition Sémawé, dérivée de cette 5.0 : elle sert à explorer des allégements et des ajouts que le texte officiel ne porte pas. Pour adopter la version de référence, c'est HolacracyOne qui fait foi.",
  },
  {
    q: "Quel rapport avec l'outil de HolacracyOne ?",
    a: "HolacracyOne propose son propre composeur sur la Constitution 5.0 officielle. Les deux outils coexistent sans se confondre : celui-ci travaille la stratification (Micro, Lite, Intégrale) et les extensions que la 5.0 ne prévoit pas.",
  },
];

export default function ComprendrePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Documentation
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-medium leading-tight text-slate-900 sm:text-5xl">
          Comprendre la Constitution
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          Une Constitution n&apos;est pas un règlement intérieur : c&apos;est le
          texte qui dit où se prennent les décisions et jusqu&apos;où va
          l&apos;autorité de chacun. Avant de composer la vôtre, quelques
          repères sur ce que ce texte fait, et sur ce qu&apos;il ne fait pas.
        </p>

        {/* Questions fréquentes. Gabarit éditorial : la question porte la
            typographie de titrage, le numéro tient la marge, un filet sépare
            les entrées. Les cartes encadrées donnaient à trois réponses le
            poids visuel de trois produits. */}
        <h2 className="mt-16 font-serif text-2xl font-medium text-slate-900">
          Questions fréquentes
        </h2>
        <dl className="mt-8 border-t border-slate-200">
          {QA.map((item, i) => (
            <div
              key={item.q}
              className="grid gap-x-8 gap-y-3 border-b border-slate-200 py-8 sm:grid-cols-[3rem_1fr]"
            >
              <dt className="font-serif text-lg leading-snug text-slate-400 sm:text-right">
                {String(i + 1).padStart(2, "0")}
              </dt>
              <div>
                <dt className="font-serif text-xl leading-snug text-slate-900">
                  {item.q}
                </dt>
                <dd className="mt-3 max-w-2xl leading-relaxed text-slate-600">
                  {item.a}
                </dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/composer"
            className="inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Composer ma Constitution →
          </Link>
          <Link
            href="/lite"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            Lire d&apos;abord la version Lite
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
