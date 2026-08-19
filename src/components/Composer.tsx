"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";
import IntroBanner from "@/components/IntroBanner";
import { fontVars, safeLogo } from "@/lib/branding";
import { ComposerDocument } from "@/components/composer/ComposerDocument";
import { ComposerEntete } from "@/components/composer/ComposerEntete";
import { ComposerModales } from "@/components/composer/ComposerModales";
import { ComposerPanel } from "@/components/composer/ComposerPanel";
import { ComposerSommaire } from "@/components/composer/ComposerSommaire";
import { ComposerTiroir } from "@/components/composer/ComposerTiroir";
import { COACHES } from "@/components/composer/coachs";
import { chargerLogo } from "@/components/composer/logo";
import { useComposerBrouillon } from "@/components/composer/useComposerBrouillon";
import { useComposerCompte } from "@/components/composer/useComposerCompte";
import { useComposerExport } from "@/components/composer/useComposerExport";
import {
  type VersionAppliquee,
  useComposerVersions,
} from "@/components/composer/useComposerVersions";
import { useComposition } from "@/components/composer/useComposition";
import { useReducedMotion } from "framer-motion";
import {
  type ConstitutionData,
  defaultActive,
  normalizeActive,
} from "@/lib/constitution";
import {
  type ContentRef,
  currentContentRef,
} from "@/lib/releases";
import { getSupabase } from "@/lib/supabase";
import { COMPOSER, type Locale } from "@/lib/i18n";

// Freemium par paliers : Cœur + Intégrale en accès libre ; les Extensions, les
// Apps et l'export (PDF/copie/sauvegarde) requièrent un compte.

interface Branding {
  logo: string;
  setLogo: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
}

export default function Composer({
  data: fondCourant,
  branding,
  onTermClick,
  locale = "fr",
}: {
  data: ConstitutionData;
  branding: Branding;
  onTermClick: (key: string) => void;
  locale?: Locale;
}) {
  // Le fond rendu n'est pas toujours celui de la page : rouvrir une version
  // figée sur une release archivée doit afficher **le texte de cette release**,
  // sinon la version n'est qu'une configuration et le document change sous les
  // pieds de qui l'a adoptée. `fondCourant` reste la référence de ce qu'on sert
  // aujourd'hui ; `data` est ce qu'on compose ici et maintenant.
  const [data, setData] = useState<ConstitutionData>(fondCourant);
  const [contentRef, setContentRef] = useState<ContentRef | null>(() =>
    currentContentRef(locale),
  );
  // Au départ : la Lite complète = tous les blocs retirables cochés.
  const [active, setActive] = useState<ReadonlySet<string>>(() =>
    defaultActive(data),
  );
  const [showIntent, setShowIntent] = useState(true);
  const [title, setTitle] = useState(data.meta.title);
  const [values, setValues] = useState("");
  const { logo, setLogo, font, setFont, titleColor, setTitleColor } = branding;
  const t = COMPOSER[locale];

  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const supabase = useMemo(() => getSupabase(), []);

  // L'export vit dans son hook (#1057) : il connaît le document, le compte
  // (l'export est derrière le mur) et la proposition de session offerte qui suit
  // un export réussi. Le composant n'en garde que l'état d'attente et l'erreur.
  const exportCtl = useComposerExport({
    t,
    locale,
    data,
    active,
    contentRef,
    showIntent,
    titre: title,
    valeurs: values,
    branding: { logo, font, titleColor },
    onGate: () => setGate("pdf"),
    estConnecte: () => account,
  });
  const {
    pdfBusy,
    pdfError,
    booking,
    setBooking,
    doGeneratePdf,
    handlePdf,
    precharger,
  } = exportCtl;

  // Le brouillon et la navigation dans le document vivent dans leur hook (#1057) :
  // lecture au montage, persistance différée, surlignage du sommaire au
  // défilement, et le défilement vers ce qu'une bascule vient de changer.
  const { activeId, goTo, viser, mettreAbriBrouillon } = useComposerBrouillon({
    data,
    active,
    setActive,
    title,
    setTitle,
    values,
    setValues,
    onNavigation: () => setMobileOpen(false),
  });

  // Le compte, sa session et ses portes vivent dans leur hook (#1057). Le
  // Composer n'en garde que ce qu'il montre, et ce qu'il fait juste après une
  // connexion réussie (reprendre l'export qui l'avait déclenchée).
  const compte = useComposerCompte({
    supabase,
    onAvantRedirection: mettreAbriBrouillon,
    onConnexionSimulee: (raison) => {
      if (raison === "pdf") doGeneratePdf();
    },
  });
  const {
    account,
    user,
    gate,
    setGate,
    email,
    setEmail,
    otpSent,
    needsCompany,
    setNeedsCompany,
    company,
    setCompany,
    signInGoogle,
    signInOtp,
    submitCompany,
    signOut,
  } = compte;

  /** Pose sur le document ce qu'une version ouverte (ou rejouée) rend. */
  const appliquerVersion = useCallback(
    ({ fond, contentRef: ref, payload }: VersionAppliquee) => {
      setData(fond);
      setContentRef(ref);
      // Le payload vient de la base : ancien, incohérent ou forgé. Il passe par
      // la frontière d'entrée avant d'atteindre le moteur.
      setActive(normalizeActive(fond, payload.active ?? []));
      setTitle(payload.title ?? fond.meta.title);
      setValues(payload.values ?? "");
      setTitleColor(payload.titleColor ?? "");
      setFont(payload.font ?? "source-serif");
      setLogo(safeLogo(payload.logo));
    },
    [setFont, setLogo, setTitleColor],
  );

  // Les versions enregistrées vivent dans leur hook (#1057) : liste, messages, et
  // les six gestes qui les manipulent. Le Composer n'en garde que ce qu'il
  // affiche, et la façon dont une version ouverte se pose sur le document.
  const versionsCtl = useComposerVersions({
    t,
    locale,
    account,
    fondCourant,
    onGate: (raison) => setGate(raison),
    onApply: appliquerVersion,
    composition: () => ({
      title,
      values,
      active: [...active],
      titleColor: titleColor || undefined,
      font,
      logo: logo || undefined,
    }),
  });
  const {
    versions,
    versionMsg,
    versionsUnread,
    versionBusy,
    releaseMsg,
    aFiger,
    aRejouer,
    handleSaveVersion,
    handleLoadVersion,
    handleRenameVersion,
    handleDeleteVersion,
    handlePinVersion,
    handleMigrateVersion,
  } = versionsCtl;

  // Les sélecteurs de composition vivent dans leur hook (#1057) : ils dérivent du
  // fond et de l'état actif, rien d'autre. Le document rend leur sortie.
  const vue = useComposition({
    data,
    active,
    t,
    setActive,
    estConnecte: () => account,
    onGate: () => setGate("modules"),
    viser,
  });
  const {
    toggle,
    composedFor,
    availableChips,
    removedRetirables,
    inactiveAdvanced,
    gaps,
    tierLabel,
    modulesByTier,
    pct,
    versionLabel,
  } = vue;

  const sommaire = (
    <ComposerSommaire data={data} t={t} activeId={activeId} goTo={goTo} />
  );

  const atelier = (
    <ComposerPanel
      data={data}
      t={t}
      doc={{
        active,
        toggle,
        setActive,
        gaps,
        tierLabel,
        modulesByTier,
      }}
      versions={{
        liste: versions,
        message: versionMsg,
        illisible: versionsUnread,
        occupe: versionBusy,
        pdfEnEchec: pdfError,
        releaseMsg,
        aFiger,
        aRejouer,
        onSave: handleSaveVersion,
        onLoad: handleLoadVersion,
        onRename: handleRenameVersion,
        onDelete: handleDeleteVersion,
        onPin: handlePinVersion,
        onMigrate: handleMigrateVersion,
      }}
      compte={{ account, onGate: setGate }}
      identite={{
        logo,
        onLogoChange: (e) => chargerLogo(e, setLogo),
        setLogo,
        font,
        setFont,
        titleColor,
        setTitleColor,
      }}
    />
  );

  return (
    <div>
      {/* Barre mobile */}
      <div className="sticky top-11 z-20 flex items-center justify-between border-b border-rule bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M2.5 4h11M2.5 8h11M2.5 12h11"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          {t.mobilePanel}
        </button>
        <span className="text-xs text-slate-500">
          {active.size > 0 ? t.mobileActive(active.size) : t.mobileCore}
        </span>
      </div>

      {/* Largeur de l'atelier. La coquille était en `max-w-6xl` : sur un écran
          de 1 440 px, 288 px mouraient de chaque côté pendant que le texte
          courait sur 726 px, soit ~85 caractères par ligne — ni la pleine
          largeur assumée, ni une mesure décidée. La coquille prend maintenant
          la largeur disponible (bornée à 96rem, au-delà l'œil ne suit plus les
          allers-retours), et c'est le texte qui porte sa propre mesure : une
          colonne de ~66 caractères, plus une marge où les libellés de modules
          vont se poser. Colonne et marge : le geste éditorial, pas une colonne
          centrée dans du vide.

          Trois zones à partir de 1 024 px, et non deux : l'atelier à gauche (ce
          qu'on règle), le document au centre avec sa marge d'annotation, le
          sommaire à droite (ce qu'on parcourt). Le sommaire ouvrait le rail, six
          lignes avant la première commande, et ses 182 px étaient l'essentiel du
          débordement qui obligeait le rail à sa propre barre de défilement. Dans
          la marge, il donne à celle-ci sa seconde raison d'être : elle porte les
          libellés des modules insérés et lui, au lieu de 176 px pour un libellé.

          Les largeurs vivent en jetons dans `globals.css` — la somme des trois
          colonnes et de leurs écarts doit tenir dans la coquille à chaque
          palier, sinon la marge d'annotation se fait rogner. Les écarts se
          resserrent par rapport à la mise en page à deux colonnes : trois
          colonnes ne tiennent pas avec 64 px entre chacune. */}
      <div className="cc-atelier mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
        {/* Atelier (desktop) */}
        <aside className="hidden lg:sticky lg:top-16 lg:block">{atelier}</aside>

        {/* Document : la police choisie surcharge --font-serif/--font-sans
            pour tout ce qui est dedans (titre, intertitres, corps). */}
        <main
          className="min-w-0"
          style={fontVars(font)}
        >
        {/* La colonne du document, posée une fois pour le fronton, le bandeau et
            le corps. La mesure est en `66ch` — les cinq polices n'ont pas la même
            largeur de caractère — mais `ch` se résout dans la police *et* la
            taille de l'élément : deux colonnes calculées séparément se centraient
            sur 559 et 586 px, et leurs bords gauches se décalaient. Une seule
            colonne, un seul calcul, et tout s'aligne. */}
        <div className="doc-prose doc-colonne text-[1.05rem]">
        <div className="doc-measure">
          <IntroBanner locale={locale} />
        </div>
        <ComposerEntete
          t={t}
          locale={locale}
          data={data}
          title={title}
          setTitle={setTitle}
          versionLabel={versionLabel}
          pct={pct}
          showIntent={showIntent}
          setShowIntent={setShowIntent}
          pdfBusy={pdfBusy}
          onPdf={handlePdf}
          precharger={precharger}
          logo={logo}
          titleColor={titleColor}
          actifs={active.size}
          reduce={Boolean(reduce)}
          compte={{
            connecte: account,
            nom: user?.user_metadata?.full_name,
            onSignOut: signOut,
          }}
        />

        <ComposerDocument
          data={data}
          t={t}
          locale={locale}
          composedFor={composedFor}
          showIntent={showIntent}
          onTermClick={onTermClick}
          values={values}
          setValues={setValues}
          toggle={toggle}
          availableChips={availableChips}
          removedRetirables={removedRetirables}
          inactiveAdvanced={inactiveAdvanced}
          coaches={COACHES}
          onBook={() => setBooking(true)}
        />
        </div>
        </main>

        {/* Sommaire (desktop) : dans la marge, du côté où l'œil revient. */}
        <div className="thin-scroll hidden max-h-[calc(100vh-4rem)] overflow-y-auto lg:sticky lg:top-16 lg:block">
          {sommaire}
        </div>
      </div>

      <ComposerTiroir
        ouvert={mobileOpen}
        onClose={() => setMobileOpen(false)}
        fermer={t.close}
      >
        {sommaire}
        <div className="mt-6 border-t border-rule pt-4">{atelier}</div>
      </ComposerTiroir>

      <ComposerModales
        t={t}
        gate={gate}
        setGate={setGate}
        user={user}
        email={email}
        setEmail={setEmail}
        otpSent={otpSent}
        signInGoogle={signInGoogle}
        signInOtp={signInOtp}
        needsCompany={needsCompany}
        setNeedsCompany={setNeedsCompany}
        account={account}
        company={company}
        setCompany={setCompany}
        submitCompany={submitCompany}
        booking={booking}
        setBooking={setBooking}
        coaches={COACHES}
      />
    </div>
  );
}
