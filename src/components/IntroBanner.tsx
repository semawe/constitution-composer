"use client";

const LS_KEY = "cc-intro-dismissed";

/** Bandeau d'introduction : proposition de valeur + « comment ça marche ».
 *  Rendu statiquement (présent dans le HTML exporté, utile au SEO) ; une fois
 *  fermé, il est masqué sans flash par la classe `intro-off` posée sur <html>
 *  avant le paint par le script d'en-tête (cf. layout.tsx / globals.css). */
export default function IntroBanner() {
  const dismiss = () => {
    document.documentElement.classList.add("intro-off");
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {}
  };

  return (
    <section
      data-intro
      aria-label="Présentation de l'outil"
      className="relative mb-8 rounded-lg border border-slate-200 bg-slate-50 p-5"
    >
      <button
        onClick={dismiss}
        aria-label="Masquer la présentation"
        className="absolute right-3 top-3 rounded px-1.5 text-sm text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
      >
        ✕
      </button>
      <h2 className="pr-8 font-serif text-lg font-semibold text-slate-900">
        Composez la Constitution de votre organisation
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Cet outil assemble une Constitution Holacracy v6 sur mesure : un socle
        complet, des blocs que vous conservez ou retirez, des extensions que
        vous activez au fil du texte. Le résultat s&apos;exporte en PDF prêt à
        ratifier, à l&apos;identité de votre organisation.
      </p>
      <details className="mt-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700 transition hover:text-slate-900">
          Comment ça marche
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Lisez le texte : le socle est déjà en place, chaque module se coche
            ou se décoche à l&apos;endroit où il s&apos;insère.
          </li>
          <li>
            Complétez la Déclaration de Principes et l&apos;identité visuelle
            (logo, police, couleur) dans les autres onglets.
          </li>
          <li>
            Créez un compte gratuit pour activer les extensions, sauvegarder
            vos versions et exporter le PDF.
          </li>
        </ol>
      </details>
    </section>
  );
}
