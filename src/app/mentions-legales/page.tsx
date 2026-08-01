import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import { HETEROSTASIA_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Éditeur, hébergeur, propriété intellectuelle et traitement des données personnelles du site constitution-composer.com.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav locale="fr" />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-4xl font-medium leading-tight text-slate-900">
          Mentions légales
        </h1>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Éditeur du site
          </h2>
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-slate-600">
            <p className="font-medium text-slate-800">Sémawé</p>
            <p>Société par actions simplifiée coopérative à capital variable</p>
            <p>Siège social : 1 rue des Pins, 38100 Grenoble, France</p>
            <p>RCS Grenoble 839 472 420 — SIRET 839 472 420 00026</p>
            <p>Président : Aliocha Iordanoff</p>
            <p>
              Contact :{" "}
              <a
                href="mailto:contact@semawe.fr"
                className="text-teal-700 underline transition hover:text-teal-800"
              >
                contact@semawe.fr
              </a>{" "}
              — 04 86 65 26 22
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Directrice de la publication
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Juliette Brunerie
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Conception et maintenance
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            <a
              href={HETEROSTASIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 underline transition hover:text-teal-800"
            >
              Heterostasia
            </a>
            , société par actions simplifiée, 1 rue des Pins, 38100 Grenoble,
            RCS Grenoble 108 072 919.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Hébergement
          </h2>
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-slate-600">
            <p className="font-medium text-slate-800">OVH SAS</p>
            <p>2 rue Kellermann, 59100 Roubaix, France</p>
            <p>
              <a
                href="https://www.ovhcloud.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline transition hover:text-teal-800"
              >
                ovhcloud.com
              </a>
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Propriété intellectuelle et licence
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Le code source du Composeur est publié sous licence{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.fr.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 underline transition hover:text-teal-800"
            >
              AGPL-3.0
            </a>
            . Le texte de la Constitution Holacracy et ses traductions relèvent
            de leurs licences respectives, indiquées à la source. Les éléments
            graphiques et la marque Sémawé restent la propriété de Sémawé.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Données personnelles
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
            <p>
              La création d’un compte collecte une adresse électronique et, le
              cas échéant, un nom et une organisation. Ces données servent
              exclusivement à l’authentification et à la conservation de vos
              compositions. Elles ne sont ni vendues ni cédées à des tiers. Le
              stockage et l’authentification sont assurés par Supabase, en
              qualité de sous-traitant.
            </p>
            <p>
              La mesure d’audience passe par Umami, qui n’utilise pas de cookie
              et ne collecte aucune donnée personnelle.
            </p>
            <p>
              Conformément au Règlement général sur la protection des données,
              vous disposez d’un droit d’accès, de rectification, de portabilité
              et de suppression des données vous concernant, en écrivant à{" "}
              <a
                href="mailto:contact@semawe.fr"
                className="text-teal-700 underline transition hover:text-teal-800"
              >
                contact@semawe.fr
              </a>
              .
            </p>
          </div>
        </section>
      </main>
      <SiteFooter locale="fr" />
    </div>
  );
}
