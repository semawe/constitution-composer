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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav locale="fr" />
      <main className="flex-1 mx-auto max-w-3xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-4xl font-medium leading-tight text-strong">
          Mentions légales
        </h1>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Éditeur du site
          </h2>
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-body">
            <p className="font-medium text-body">Sémawé</p>
            <p>Société par actions simplifiée coopérative à capital variable</p>
            <p>Siège social : 1 rue des Pins, 38100 Grenoble, France</p>
            <p>RCS Grenoble 839 472 420 — SIRET 839 472 420 00026</p>
            <p>Président : Aliocha Iordanoff</p>
            <p>
              Contact :{" "}
              <a
                href="mailto:contact@semawe.fr"
                className="text-accent-text underline transition hover:text-teal-800"
              >
                contact@semawe.fr
              </a>{" "}
              — 04 86 65 26 22
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Directrice de la publication
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-body">
            Juliette Brunerie
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Conception et maintenance
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-body">
            <a
              href={HETEROSTASIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline transition hover:text-teal-800"
            >
              Heterostasia
            </a>
            , société par actions simplifiée, 1 rue des Pins, 38100 Grenoble,
            RCS Grenoble 108 072 919.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Hébergement
          </h2>
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-body">
            <p className="font-medium text-body">OVH SAS</p>
            <p>2 rue Kellermann, 59100 Roubaix, France</p>
            <p>
              <a
                href="https://www.ovhcloud.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline transition hover:text-teal-800"
              >
                ovhcloud.com
              </a>
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Propriété intellectuelle et licence
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-body">
            Le code source du Composeur est publié sous licence{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.fr.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline transition hover:text-teal-800"
            >
              AGPL-3.0
            </a>
            . Le texte de la Constitution Holacracy et ses traductions relèvent
            de leurs licences respectives, indiquées à la source. Les éléments
            graphiques et la marque Sémawé restent la propriété de Sémawé.
          </p>
          <p>
            Holacracy® est une marque déposée de HolacracyOne LLC. Sémawé
            n&apos;est ni affilié à HolacracyOne, ni mandaté par elle. Le texte
            composé sur ce site est une édition Sémawé, dérivée de la
            Constitution Holacracy 5.0 : il ne constitue pas une nouvelle
            version officielle de la Constitution, et n&apos;engage pas
            HolacracyOne. La version officielle de référence est publiée par
            HolacracyOne.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Données personnelles
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-body">
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
                className="text-accent-text underline transition hover:text-teal-800"
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
