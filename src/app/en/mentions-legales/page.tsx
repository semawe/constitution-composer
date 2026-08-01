import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import { HETEROSTASIA_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Legal notice",
  description:
    "Publisher, host, intellectual property and personal data processing for constitution-composer.com.",
};

export default function LegalNoticePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav locale="en" />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-4xl font-medium leading-tight text-slate-900">
          Legal notice
        </h1>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Publisher
          </h2>
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-slate-600">
            <p className="font-medium text-slate-800">Sémawé</p>
            <p>
              Worker cooperative (SAS SCOP) with variable capital, registered in
              France
            </p>
            <p>Registered office: 1 rue des Pins, 38100 Grenoble, France</p>
            <p>
              Grenoble Trade Register 839 472 420 — SIRET 839 472 420 00026
            </p>
            <p>President: Aliocha Iordanoff</p>
            <p>
              Contact:{" "}
              <a
                href="mailto:contact@semawe.fr"
                className="text-teal-700 underline transition hover:text-teal-800"
              >
                contact@semawe.fr
              </a>{" "}
              — +33 4 86 65 26 22
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Publication director
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Juliette Brunerie
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Design and maintenance
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
            , simplified joint-stock company, 1 rue des Pins, 38100 Grenoble,
            France, Grenoble Trade Register 108 072 919.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Hosting
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
            Intellectual property and licence
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            The Composer source code is released under the{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 underline transition hover:text-teal-800"
            >
              AGPL-3.0
            </a>{" "}
            licence. The Holacracy Constitution and its translations remain
            under their own licences, stated at the source. Graphic assets and
            the Sémawé trademark remain the property of Sémawé.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Personal data
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
            <p>
              Creating an account collects an email address and, where
              provided, a name and an organisation. This data is used solely to
              authenticate you and to store your compositions. It is neither
              sold nor shared with third parties. Storage and authentication are
              handled by Supabase, acting as a processor.
            </p>
            <p>
              Audience measurement uses Umami, which sets no cookie and collects
              no personal data.
            </p>
            <p>
              Under the General Data Protection Regulation, you have the right
              to access, rectify, port and erase your data by writing to{" "}
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
      <SiteFooter locale="en" />
    </div>
  );
}
