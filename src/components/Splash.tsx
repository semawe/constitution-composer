"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
  }),
};

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
          <div className="rounded-xl border border-slate-300 bg-white p-4">
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
          <motion.span
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="inline-block rounded-md bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
          >
            Holacracy · Constitution v6
          </motion.span>
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="mt-4 max-w-2xl font-serif text-4xl font-medium leading-tight text-slate-900 sm:text-5xl"
          >
            Votre Constitution, composée à la carte
          </motion.h1>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600"
          >
            Le texte part d&apos;un socle éprouvé. Vous activez les modules qui
            correspondent à votre organisation, la Constitution se compose à
            mesure que vous décidez, puis s&apos;exporte en PDF prêt à ratifier.
          </motion.p>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/composer"
              className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              Composer ma Constitution →
            </Link>
            <Link
              href="/lite"
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Lire la version Lite
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50/60 dark:bg-slate-800/20">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
            >
              <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">{v.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {v.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-serif text-2xl font-medium text-slate-900">
          Comment ça marche
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
              className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/40"
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
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200">
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
