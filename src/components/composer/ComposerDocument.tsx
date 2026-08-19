import { AnimatePresence, motion } from "framer-motion";
import {
  type ConstitutionData,
  type Module,
  type RenderedItem,
} from "@/lib/constitution";
import { type COMPOSER, type Locale } from "@/lib/i18n";
import Prose from "@/components/Prose";
import {
  InsertDivider,
  PreambleValues,
  TIER_UI,
} from "@/components/composer/pieces";

// Le document composé, tel qu'il s'affiche. Sorti de `Composer.tsx` (#1057).
//
// Il ne décide rien : il rend la sortie du moteur (`compose()`, groupée par bloc
// dans `composedFor`), les notes d'intention si l'interrupteur le demande, les
// marqueurs de réinsertion des blocs retirés et les « + » d'insertion. Toute la
// logique de composition est restée en amont, ce qui est la seule façon de
// garantir que l'écran et le PDF racontent la même chose.

type Ui = (typeof COMPOSER)["fr"];

export function ComposerDocument({
  data,
  t,
  locale,
  composedFor,
  showIntent,
  onTermClick,
  values,
  setValues,
  toggle,
  availableChips,
  removedRetirables,
  inactiveAdvanced,
  coaches,
  onBook,
}: {
  data: ConstitutionData;
  t: Ui;
  locale: Locale;
  composedFor: (anchor: string) => RenderedItem[];
  showIntent: boolean;
  onTermClick: (key: string) => void;
  values: string;
  setValues: (v: string) => void;
  toggle: (id: string) => void;
  availableChips: (anchor: string) => Module[];
  removedRetirables: (anchor: string) => Module[];
  inactiveAdvanced: (anchor: string) => Module[];
  /** Coachs proposés à la réservation ; vide = l'encart disparaît. */
  coaches: { name: string; url: string }[];
  onBook: () => void;
}) {
  return (
        <article className="doc-prose text-[1.05rem] text-slate-800">
          {data.blocks.map((block) => {
            return (
              // Pas d'entrée animée sur le corps constitutionnel. Elle
              // s'obtenait par `whileInView`, donc par un `opacity:0` écrit
              // dans l'HTML prérendu : le texte des six articles partait
              // invisible et n'apparaissait que si React s'hydratait, et un
              // lien profond (`/composer#article-4`) laissait sa cible à zéro
              // — l'IntersectionObserver ne voit pas ce qu'on a sauté. Un
              // document qu'on vient étudier n'a pas à s'animer pour exister.
              <section
                key={block.id}
                id={block.id}
                className="mb-10 scroll-mt-24"
              >
                <h2 className="mb-3 font-serif text-2xl font-semibold text-slate-900">
                  {block.heading}
                </h2>
                <AnimatePresence initial={false}>
                  {showIntent && block.intent && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden border-l-2 border-slate-200 pl-3 text-sm italic text-slate-500"
                    >
                      {block.intent}
                    </motion.p>
                  )}
                </AnimatePresence>

                <Prose text={block.text} onTermClick={onTermClick} locale={locale} />

                {/* Insertions actives et remplacements obligatoires, dans
                    l'ordre où le moteur les compose : une seule passe sur sa
                    sortie, pas deux filtrages du même tableau. */}
                <AnimatePresence initial={false}>
                  {composedFor(block.anchor).map((item) => {
                    const ui = item.warning ? TIER_UI.warning : TIER_UI[item.tier];
                    const tinted =
                      item.warning ||
                      item.kind === "fallback" ||
                      item.tier === "pedagogique";
                    const domId =
                      item.kind === "fallback"
                        ? `fb-${item.moduleId}`
                        : `ins-${item.moduleId}-${item.insertionIndex}`;
                    return (
                      <motion.div
                        key={item.key}
                        id={domId}
                        layout
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        className={`mt-5 scroll-mt-24 overflow-hidden border-l-2 ${ui.bar} ${
                          // La teinte de fond ne sert que là où le texte change
                          // de registre : une piste pédagogique est un
                          // commentaire, une règle par défaut un avertissement.
                          // Sur les modules, elle faisait de la page une pile de
                          // boîtes colorées — quatorze actives par défaut sur
                          // dix-neuf — là où la promesse est de composer « au fil
                          // du texte ». Le liseré de teinte et le libellé disent
                          // l'appartenance ; le texte reste sur le fond de la page.
                          tinted ? `rounded-r-md ${ui.tint} py-3 pl-4 pr-3` : "py-1 pl-5"
                        }`}
                      >
                        <span
                          className={`mb-1.5 inline-block text-[0.7rem] font-medium uppercase tracking-wider ${
                            tinted
                              ? `rounded-full px-2 py-0.5 normal-case tracking-normal ring-1 ring-inset ${ui.tag}`
                              : ui.label
                          }`}
                        >
                          {item.kind === "fallback"
                            ? `⚠ ${t.defaultRule(item.moduleLabel ?? "")}`
                            : item.moduleLabel}
                        </span>
                        <div className="text-[0.98rem]">
                          <Prose
                            text={item.text}
                            onTermClick={onTermClick}
                            locale={locale}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Blocs retirables retirés : fin liseré + "+" pour réinsérer
                    dans le fil de lecture. */}
                {removedRetirables(block.anchor).map((m) => (
                  <button
                    key={`reins-${m.id}`}
                    id={`reins-${m.id}`}
                    onClick={() => toggle(m.id)}
                    title={t.reinsert(m.label)}
                    className="group/reins mt-3 flex w-full scroll-mt-24 items-center gap-2 text-left"
                  >
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[0.7rem] text-slate-400 transition group-hover/reins:border-teal-400 group-hover/reins:text-teal-600">
                      <span className="text-sm leading-none">+</span> {m.label}
                    </span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </button>
                ))}

                {block.id === "preambule" && (
                  <PreambleValues values={values} setValues={setValues} />
                )}

                {/* "+" entre paragraphes : extensions / apps activables ancrées ici */}
                <InsertDivider
                  modules={availableChips(block.anchor)}
                  onActivate={toggle}
                  ui={t}
                />

                {/* Renvoi inter-tiers : ce que ce tier ne couvre pas pour cet article */}
                {inactiveAdvanced(block.anchor).length > 0 && (
                  <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[0.85rem] text-violet-900">
                    <span className="font-semibold">Ce tier ne couvre pas :</span>{" "}
                    {inactiveAdvanced(block.anchor).map((m, i, arr) => (
                      <span key={m.id}>
                        <button
                          onClick={() => toggle(m.id)}
                          className="underline decoration-dotted underline-offset-2 hover:text-violet-700"
                          title={m.description}
                        >
                          {m.label}
                        </button>
                        <span className="ml-1 text-[0.75rem] text-violet-600">
                          [{m.tier === "extension" ? "Extension" : "App"}]
                        </span>
                        {i < arr.length - 1 && <span className="mr-1">,</span>}
                      </span>
                    ))}{" "}
                    <span className="text-violet-600">
                      Activez-les pour voir ce contenu.
                    </span>
                  </div>
                )}
              </section>
            );
          })}

          {coaches.length > 0 && (
            <div className="mt-12 rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50 to-violet-50 p-6">
              <h2 className="font-serif text-xl font-semibold text-slate-900">
                Aller plus loin avec un coach
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Composer, c&apos;est un début. Faites relire et co-construire votre
                Constitution avec un coach certifié en Holacracy.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                <li>
                  🎁 <strong>20 minutes de découverte offertes</strong> à la
                  création de votre compte.
                </li>
                <li>
                  Supervision par un coach senior :{" "}
                  <strong>500 €/h</strong> ou <strong>3000 €/jour</strong>.
                </li>
              </ul>
              <button
                onClick={onBook}
                className="mt-4 inline-flex items-center gap-2 rounded-full btn-ink px-5 py-2.5 text-sm font-medium transition"
              >
                🎁 Réserver mes 20 minutes offertes
              </button>
            </div>
          )}

          <footer className="mt-10 flex items-start gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-semawe-light.png"
              alt="Sémawé"
              className="h-10 w-auto shrink-0 dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-semawe-dark.png"
              alt="Sémawé"
              className="hidden h-10 w-auto shrink-0 dark:block"
            />
            <span>{t.pdfFooter(data.meta.license, data.meta.notice)}</span>
          </footer>
        </article>
  );
}
