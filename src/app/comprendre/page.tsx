import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Comprendre la Constitution Holacracy v6",
  description:
    "Ce qu'est la Constitution Holacracy v6, comment l'adopter à la carte, et les questions fréquentes.",
};

const QA = [
  {
    q: "Qu'est-ce que la Constitution Holacracy v6 ?",
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
];

export default function ComprendrePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-4xl font-medium leading-tight text-slate-900">
          Comprendre
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          Quelques repères avant de composer. Cette page accueillera le contenu
          pédagogique de fond (à enrichir).
        </p>
        <div className="mt-10 space-y-8">
          {QA.map((item) => (
            <div key={item.q}>
              <h2 className="text-lg font-medium text-slate-900">{item.q}</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
        <Link
          href="/composer"
          className="mt-12 inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Composer ma Constitution →
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
