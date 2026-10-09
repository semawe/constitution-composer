"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { isGatedTier } from "@/components/composer/pieces";
import {
  type BrouillonRestaure,
  useComposerBrouillon,
} from "@/components/composer/useComposerBrouillon";
import {
  type Porte,
  useComposerCompte,
} from "@/components/composer/useComposerCompte";
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
  isOutdated,
  releaseLabel,
} from "@/lib/releases";
import { reprendreIntention, retenirIntention } from "@/lib/intention";
import { getService } from "@/lib/service";
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
  demande = null,
}: {
  data: ConstitutionData;
  branding: Branding;
  onTermClick: (key: string) => void;
  locale?: Locale;
  /**
   * Un module à activer, demandé d'ailleurs (App Store, fiche d'une app). `n`
   * distingue deux demandes successives du même module.
   */
  demande?: { module: string; n: number } | null;
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
  const service = useMemo(() => getService(), []);

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

  // Le compte, sa session et ses portes vivent dans leur hook (#1057). Le
  // Composer n'en garde que ce qu'il montre, et ce qu'il fait juste après une
  // connexion réussie (reprendre le geste qui l'avait demandée).
  //
  // Le module dont la bascule a ouvert le mur : c'est lui qu'on activera au
  // retour de la connexion, pas « un module » en général.
  const moduleDemande = useRef<string | null>(null);
  const gesteDe = (raison: Porte): string =>
    raison === "modules" && moduleDemande.current
      ? `activer:${moduleDemande.current}`
      : (raison ?? "account");
  // Rempli plus bas, une fois le brouillon connu : le compte se déclare avant
  // lui, parce que le brouillon a besoin de savoir qui est là.
  const abri = useRef<(raison: Porte) => void>(() => {});
  const compte = useComposerCompte({
    service,
    onAvantRedirection: (raison) => abri.current(raison),
    // Le compte simulé ne quitte pas la page, mais le geste suit le même
    // chemin : retenu ici, repris quand l'identité est établie.
    onConnexionSimulee: (raison) => retenirIntention(gesteDe(raison)),
  });
  const {
    account,
    user,
    identite,
    sessionConnue,
    gate,
    setGate,
    connexion,
    needsCompany,
    setNeedsCompany,
    company,
    setCompany,
    companyEchec,
    submitCompany,
    signOut,
  } = compte;

  /** Pose sur le document ce que le brouillon du navigateur a gardé. */
  const restaurerBrouillon = useCallback((b: BrouillonRestaure) => {
    setData(b.fond);
    setContentRef(b.contentRef);
    // Le brouillon vient du navigateur : il passe par la même frontière
    // d'entrée qu'une version lue en base.
    if (b.active) setActive(normalizeActive(b.fond, b.active));
    if (b.title) setTitle(b.title);
    setValues(b.values);
  }, []);

  /** L'identité visuelle revient au défaut : logo, police, couleur du titre. */
  const oublierIdentiteVisuelle = useCallback(() => {
    setLogo("");
    setFont("source-serif");
    setTitleColor("");
  }, [setFont, setLogo, setTitleColor]);

  // Le brouillon et la navigation dans le document vivent dans leur hook (#1057) :
  // lecture au montage, persistance différée, surlignage du sommaire au
  // défilement, et le défilement vers ce qu'une bascule vient de changer.
  const {
    activeId,
    goTo,
    viser,
    brouillonPret,
    mettreAbriBrouillon,
    cederLaPlace,
    oublierBrouillon,
  } = useComposerBrouillon({
    fondCourant,
    locale,
    data,
    contentRef,
    active,
    title,
    values,
    sessionConnue,
    identite,
    onRestaurer: restaurerBrouillon,
    onEcarter: oublierIdentiteVisuelle,
    onNavigation: () => setMobileOpen(false),
  });
  useEffect(() => {
    abri.current = (raison) => {
      mettreAbriBrouillon();
      retenirIntention(gesteDe(raison));
    };
  });

  /** Pose sur le document ce qu'une version ouverte (ou rejouée) rend. */
  const appliquerVersion = useCallback(
    ({ fond, contentRef: ref, payload }: VersionAppliquee) => {
      // Un document ouvert explicitement passe avant tout brouillon encore en
      // cours de restauration.
      cederLaPlace();
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
    // `cederLaPlace` ne lit qu'un ref : il n'a pas à relancer ce rappel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setFont, setLogo, setTitleColor],
  );

  // Les versions enregistrées vivent dans leur hook (#1057) : liste, messages, et
  // les six gestes qui les manipulent. Le Composer n'en garde que ce qu'il
  // affiche, et la façon dont une version ouverte se pose sur le document.
  const versionsCtl = useComposerVersions({
    t,
    locale,
    account,
    identite,
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
    // Le fond du document affiché. Une version d'avant l'archivage n'en porte
    // aucun (`contentRef` nul) et s'affiche, en le disant, sur le texte du jour
    // dans la langue de la page : c'est donc ce texte-là, celui que la personne
    // a sous les yeux, qu'un nouvel enregistrement retient.
    reference: () => contentRef ?? currentContentRef(locale),
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
    refreshVersions,
    oublierVersionOuverte,
  } = versionsCtl;

  // Le document appartient à qui l'a composé. Quand ce compte s'en va —
  // déconnexion, session perdue, ou un autre compte qui prend sa place — rien
  // de lui ne reste : ni à l'écran, ni dans le brouillon du navigateur, ni dans
  // l'identité visuelle (audit du 04/10/2026, F06). Une version ouverte est une
  // copie d'un document privé ; la personne suivante sur le même poste la
  // retrouvait, y compris après rechargement.
  //
  // Le brouillon anonyme, lui, suit la personne à travers sa connexion : passer
  // de « personne » à un compte ne remet rien à zéro.
  const identiteVue = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!sessionConnue) return;
    const avant = identiteVue.current;
    identiteVue.current = identite;
    if (avant === undefined || avant === null || avant === identite) return;
    cederLaPlace();
    oublierBrouillon();
    setData(fondCourant);
    setContentRef(currentContentRef(locale));
    setActive(defaultActive(fondCourant));
    setTitle(fondCourant.meta.title);
    setValues("");
    oublierIdentiteVisuelle();
    // Ne réagit qu'au changement d'identité : le reste est lu tel qu'il est à
    // ce moment-là.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionConnue, identite]);

  /** Revient au texte du jour en gardant la configuration : sortie d'un brouillon ancien. */
  const rejoindreTexteDuJour = () => {
    cederLaPlace();
    setData(fondCourant);
    setContentRef(currentContentRef(locale));
    setActive(normalizeActive(fondCourant, [...active]));
    oublierVersionOuverte();
  };
  // Un document rendu sur un texte ancien le dit toujours, y compris quand il
  // revient d'un brouillon et non d'une version qu'on vient d'ouvrir.
  const horsTexteDuJour = Boolean(contentRef && isOutdated(contentRef));
  const messageFond =
    releaseMsg ??
    (horsTexteDuJour && contentRef
      ? t.releasePinned(releaseLabel(contentRef.release, locale))
      : null);

  // Les sélecteurs de composition vivent dans leur hook (#1057) : ils dérivent du
  // fond et de l'état actif, rien d'autre. Le document rend leur sortie.
  const vue = useComposition({
    data,
    active,
    t,
    setActive,
    estConnecte: () => account,
    onGate: (id) => {
      moduleDemande.current = id;
      setGate("modules");
    },
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

  // Ce que le Composer vient de faire à la demande d'un autre écran, dit en
  // toutes lettres : « Activer » dans l'App Store changeait d'onglet et ne
  // disait rien de l'état du module (audit du 04/10/2026, F13).
  const [annonce, setAnnonce] = useState<string | null>(null);
  useEffect(() => {
    if (!annonce) return;
    const timer = setTimeout(() => setAnnonce(null), 6000);
    return () => clearTimeout(timer);
  }, [annonce]);

  /** Active un module demandé d'ailleurs, et dit ce qu'il en est. */
  const activer = (id: string) => {
    const mod = data.modules.find((m) => m.id === id);
    if (!mod) return;
    if (active.has(id)) {
      setAnnonce(t.moduleAlreadyActive(mod.label));
      setTimeout(
        () =>
          document.getElementById(`ins-${id}-0`)?.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "center",
          }),
        60,
      );
      return;
    }
    if (!account && isGatedTier(mod.tier)) {
      // Le mur s'ouvre, et le module est retenu : il s'activera au retour.
      moduleDemande.current = id;
      setGate("modules");
      return;
    }
    toggle(id);
    setAnnonce(t.moduleActivated(mod.label));
  };

  /** Reprend le geste qui avait demandé la connexion. */
  const reprendre = (geste: string) => {
    if (geste === "pdf") doGeneratePdf();
    else if (geste === "save") void handleSaveVersion();
    else if (geste.startsWith("activer:")) activer(geste.slice(8));
  };
  // Le geste n'est repris qu'une fois la session confirmée et le brouillon
  // reposé : avant, on exporterait le document d'accueil au lieu du sien.
  useEffect(() => {
    if (!sessionConnue || !brouillonPret || !identite) return;
    const geste = reprendreIntention(
      (g) => g === "pdf" || g === "save" || g.startsWith("activer:"),
    );
    // Reprise d'un geste retenu hors de React (le navigateur l'a gardé pendant
    // l'aller-retour de connexion) : l'effet est la forme juste.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (geste) reprendre(geste);
    // Les gestes sont ceux du rendu courant : seule l'arrivée d'une identité,
    // session et brouillon établis, déclenche la reprise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionConnue, brouillonPret, identite]);

  // Une activation demandée par un autre écran attend, elle aussi, de savoir qui
  // est là : au chargement, un compte déjà connecté ne doit pas se heurter au mur.
  const demandeTraitee = useRef(0);
  useEffect(() => {
    if (!demande || !sessionConnue || !brouillonPret) return;
    if (demande.n === demandeTraitee.current) return;
    demandeTraitee.current = demande.n;
    activer(demande.module);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande, sessionConnue, brouillonPret]);

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
        onRetry: () => void refreshVersions(),
        occupe: versionBusy,
        pdfEnEchec: pdfError,
        releaseMsg: messageFond,
        aFiger,
        aRejouer,
        // Sans version à rejouer, un document resté sur un texte ancien (un
        // brouillon rechargé) garde une sortie vers le texte du jour.
        onRejoindre:
          horsTexteDuJour && !aRejouer ? rejoindreTexteDuJour : undefined,
        onSave: handleSaveVersion,
        onLoad: handleLoadVersion,
        onRename: handleRenameVersion,
        onDelete: handleDeleteVersion,
        onPin: handlePinVersion,
        onMigrate: handleMigrateVersion,
      }}
      compte={{
        account,
        onGate: (g) => {
          // « Tout activer » ne désigne aucun module en particulier.
          moduleDemande.current = null;
          setGate(g);
        },
      }}
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
      {/* La barre se cale sous la navigation, dont la hauteur varie : une rangée
          à partir de 640 px, deux en dessous. Elle était à 44 px en dur, et sur
          téléphone la seconde rangée d'onglets la recouvrait — toucher
          « Sommaire & modules » ouvrait l'onglet Constitution (audit du
          04/10/2026, F04). `--cc-nav-h` est posée par la navigation elle-même. */}
      <div className="sticky top-[var(--cc-nav-h)] z-20 flex items-center justify-between border-b border-rule bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-body"
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
        <span className="text-xs text-muted">
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
            nom: user?.nom ?? undefined,
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
        nom={t.mobilePanel}
      >
        {sommaire}
        <div className="mt-6 border-t border-rule pt-4">{atelier}</div>
      </ComposerTiroir>

      <ComposerModales
        t={t}
        gate={gate}
        setGate={setGate}
        user={user}
        connexion={connexion}
        needsCompany={needsCompany}
        setNeedsCompany={setNeedsCompany}
        account={account}
        company={company}
        setCompany={setCompany}
        companyEchec={companyEchec}
        submitCompany={submitCompany}
        booking={booking}
        setBooking={setBooking}
        coaches={COACHES}
      />

      {annonce && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-lg border border-accent-border bg-accent-soft px-4 py-3 text-center text-sm text-accent-strong shadow-lg"
        >
          {annonce}
        </p>
      )}
    </div>
  );
}
