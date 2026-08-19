export type Locale = "fr" | "en";

export function getLocaleFromPath(pathname: string): Locale {
  return pathname.startsWith("/en") ? "en" : "fr";
}

export function toOtherLocale(pathname: string): string {
  if (pathname.startsWith("/en")) {
    const stripped = pathname.slice(3) || "/";
    return stripped || "/";
  }
  return "/en" + (pathname === "/" ? "" : pathname);
}

export const UI = {
  fr: {
    nav: {
      composer: "Composer",
      micro: "Micro",
      lite: "Lite",
      integrale: "Intégrale",
      cartographie: "Cartographie",
      comprendre: "Comprendre",
      login: "Se connecter",
    },
    footer: {
      tagline: "Constitution Composer, un outil Sémawé.",
      createdByPre: "Créé par",
      createdByMid: ", fondé sur l'expérience de",
      v5Label: "Constitution 5.0 officielle",
      legal: "Mentions légales",
    },
    brand: {
      product: "Constitution Composer",
      byline: "un outil Sémawé",
      semaweAlt: "Sémawé",
    },
    /**
     * La mention que HolacracyOne demande de rendre visible (échange du
     * 18/08/2026) : que cet outil n'est pas officiel primait, pour Olivier
     * Compagne, sur le fait qu'il soit expérimental. Elle est courte parce
     * qu'elle s'affiche au-dessus du titre, à l'écran comme dans le PDF.
     */
    unofficial: "Un outil Sémawé · non affilié à HolacracyOne",
    /**
     * La phrase longue, qui dit de quoi ce texte est dérivé et ce qu'il n'est
     * pas. Elle vit ici, et non dans le `meta` des fonds, pour une raison de
     * fond : une composition sauvegardée est rendue avec le fond archivé de son
     * époque (cf. `releases.ts`). Portée par la donnée, la mention manquerait
     * aux documents enregistrés avant ce changement — précisément ceux qui
     * portent encore l'ancien titre.
     */
    derivation:
      "Version non officielle éditée par Sémawé, dérivée de la Constitution Holacracy® 5.0 de HolacracyOne LLC. Elle ne constitue pas une nouvelle version officielle de la Constitution.",
    author: {
      kicker: "L'éditeur",
      title: "Qui édite cet outil",
      body: "Constitution Composer est édité par Sémawé, société coopérative qui accompagne des organisations en Holacratie. Le texte proposé ici est une composition de Sémawé, dérivée de la Constitution Holacracy® 5.0 publiée par HolacracyOne. Il n'a pas valeur de version officielle : pour le texte de référence, HolacracyOne fait foi.",
      semaweLink: "Découvrir Sémawé",
    },
  },
  en: {
    nav: {
      composer: "Composer",
      micro: "Micro",
      lite: "Lite",
      integrale: "Full",
      cartographie: "Directory",
      comprendre: "Learn",
      login: "Sign in",
    },
    footer: {
      tagline: "Constitution Composer, a Sémawé tool.",
      createdByPre: "Built by",
      createdByMid: ", grounded in the experience of",
      v5Label: "Official 5.0 Constitution",
      legal: "Legal notice",
    },
    brand: {
      product: "Constitution Composer",
      byline: "a Sémawé tool",
      semaweAlt: "Sémawé",
    },
    unofficial: "A Sémawé tool · not affiliated with HolacracyOne",
    derivation:
      "Unofficial version published by Sémawé, derived from the Holacracy® Constitution 5.0 by HolacracyOne LLC. It is not a new official version of the Constitution.",
    author: {
      kicker: "The publisher",
      title: "Who publishes this tool",
      body: "Constitution Composer is published by Sémawé, a French worker cooperative that supports organizations practising Holacracy. The text offered here is a Sémawé composition, derived from the Holacracy® Constitution 5.0 published by HolacracyOne. It carries no official standing: for the reference text, HolacracyOne is authoritative.",
      semaweLink: "Discover Sémawé",
    },
  },
} satisfies Record<Locale, unknown>;

// App shell (tabs, nav inside the tool)
export const APP_UI = {
  fr: {
    tabs: {
      constitution: "Constitution",
      principes: "Déclaration de Principes",
      glossaire: "Glossaire",
      appstore: "App Store",
    },
    home: "Accueil",
    switchLang: "EN",
    signIn: "Se connecter",
  },
  en: {
    tabs: {
      constitution: "Constitution",
      principes: "Declaration of Principles",
      glossaire: "Glossary",
      appstore: "App Store",
    },
    home: "Home",
    switchLang: "FR",
    signIn: "Sign in",
  },
};

// Composer panel + document header UI
export const COMPOSER = {
  fr: {
    toc: "Sommaire",
    composerLabel: "Composer",
    gapWarning: (n: number) =>
      `${n} règle${n > 1 ? "s" : ""} par défaut comble${n > 1 ? "nt" : ""} les modules non activés`,
    activateAll: "Tout activer",
    baseLite: "Base Lite",
    baseLiteTitle:
      "Revenir à la Lite complète : tous les blocs retirables cochés, sans extension ni app.",
    coreOnly: "Socle seul",
    coreOnlyTitle: "Ne garder que le socle incompressible.",
    myVersions: "Mes versions",
    saving: "Enregistrement...",
    saveVersion: "Enregistrer cette version",
    saved: "Version enregistrée.",
    saveFailed: "Échec de l'enregistrement.",
    limitReached: (max: number) =>
      `Limite de ${max} versions atteinte : supprimez-en une pour enregistrer.`,
    loaded: (name: string) => `« ${name} » chargée.`,
    untitled: "Sans titre",
    loginToSave: "Connexion requise pour sauvegarder vos versions.",
    rename: "Renommer",
    renamePrompt: "Nouveau nom de la version",
    delete: "Supprimer",
    confirmDelete: (name: string) => `Supprimer la version « ${name} » ?`,
    loadTitle: "Charger cette version",
    titleAriaLabel: "Titre de votre Constitution",
    titleHint: "Titre modifiable : donnez un nom à votre Constitution.",
    fontLabel: "Police",
    logoAdd: "ajouter",
    logoChange: "changer",
    logoRemove: "retirer",
    colorLabel: "Couleur",
    colorReset: "défaut",
    loggedIn: (name: string) => `Connecté : ${name}`,
    activeAccount: "Compte actif",
    signOut: "se déconnecter",
    freeTierMsg:
      "Cœur et Intégrale en accès libre. Compte requis pour les Extensions, les Apps et le PDF.",
    showIntent: "Afficher les notes d'intention",
    pdfGenerating: "Génération...",
    pdfDownload: "Télécharger le PDF",
    pdfFailed:
      "Le PDF n'a pas pu être produit. Réessayez ; votre composition est intacte à l'écran.",
    defaultRule: (label: string) => `Règle par défaut : « ${label} » non activé`,
    releasePinned: (date: string) =>
      `Vous relisez cette version telle que vous l'avez enregistrée, avec la Constitution du ${date}. La Constitution a évolué depuis ; ce document, lui, ne change pas.`,
    releaseNotPinned:
      "Cette version est ancienne : l'application n'a pas gardé trace de la Constitution avec laquelle vous l'aviez composée. Elle s'affiche donc avec la Constitution d'aujourd'hui.",
    releasePinAction: "L'enregistrer avec la Constitution d'aujourd'hui",
    releaseMigrateAction: "En créer une version sur la Constitution d'aujourd'hui",
    releaseMigrateName: (name: string, date: string) =>
      `${name} (Constitution du ${date})`,
    releaseMigrated: (name: string) =>
      `« ${name} » a été créée sur la Constitution d'aujourd'hui. Votre version d'origine est intacte.`,
    releaseMigrateFull: (max: number) =>
      `Vos ${max} emplacements de versions sont pris. Supprimez-en une pour pouvoir créer cette nouvelle version ; votre version d'origine, elle, ne sera pas touchée.`,
    releaseMissing: (date: string) =>
      `Cette version a été composée avec la Constitution du ${date}, que l'application n'a plus. Elle n'a pas été ouverte : vous auriez lu un autre texte que le vôtre.`,
    releaseMismatch: (date: string) =>
      `La Constitution du ${date} conservée par l'application ne correspond plus à cette version. Elle n'a pas été ouverte, pour ne pas vous montrer un texte qui n'est pas le vôtre.`,
    pdfContentRef: (date: string, sha: string) =>
      `Constitution du ${date} · réf. ${sha}`,
    reinsert: (label: string) => `Réinsérer : ${label}`,
    addModuleHere: "Ajouter un module ici",
    legend: "Légende",
    legendDefaultRule: "Règle par défaut",
    versionsFailed:
      "Vos versions n'ont pas pu être lues. Rechargez la page : ce que vous voyez à l'écran n'est pas perdu.",
    versionActionFailed:
      "L'opération sur cette version a échoué. Rien n'a été modifié dans votre compte.",
    // Libellés du PDF de la Constitution
    pdfComposedOn: "Composé le",
    pdfValuesHeading: "Valeurs et principes",
    pdfDefaultRule: (label: string) => `Règle par défaut : « ${label} » non activé`,
    // Le `notice` du fond porte déjà la dérivation et la non-officialité : ce
    // pied de page ne les redit pas, il nomme l'outil et la licence.
    pdfFooter: (license: string, notice: string) =>
      `Composé avec Constitution Composer, un outil Sémawé, sous licence ${license}. ${notice}`,
    /**
     * Ligne posée au-dessus du titre du document, à l'écran comme dans le PDF.
     * Elle remplace l'affichage brut de `meta.version`, qui sortait
     * « v6-alpha » : un numéro de version qui donnait au texte l'air d'être la
     * prochaine Constitution officielle de HolacracyOne.
     */
    editionKicker: "Édition Sémawé · version non officielle",
    liteFull: "Lite complète",
    blocksRetirable: (kept: number, total: number) =>
      `${kept}/${total} blocs retirables`,
    blocksWithAddons: (kept: number, total: number, addons: number) =>
      `${kept}/${total} blocs · ${addons} ajout${addons > 1 ? "s" : ""}`,
    versionLite: "Version Lite, complète",
    versionFull: "Version intégrale",
    versionReduced: (n: number) =>
      `Version allégée, ${n} bloc${n > 1 ? "s" : ""} retiré${n > 1 ? "s" : ""}`,
    versionCustom: "Version sur-mesure",
    mobilePanel: "Sommaire & modules",
    mobileActive: (n: number) => `${n} actif${n > 1 ? "s" : ""}`,
    mobileCore: "socle",
    close: "Fermer",
    createFreeAccount: "Créez votre compte gratuit",
    gateTitle: {
      pdf: "Téléchargez votre Constitution",
      save: "Sauvegardez vos versions",
      modules: "Débloquez les modules avancés",
      account: "Créez votre compte gratuit",
    },
    gateDesc: {
      pdf: "Le PDF de votre Constitution composée est réservé aux membres, la création de compte est gratuite.",
      save: "Enregistrez jusqu'à cinq versions de votre Constitution et retrouvez-les à chaque visite. La création de compte est gratuite.",
      modules:
        "Les Extensions constitutionnelles et les Apps sont réservées aux membres. La création de compte est gratuite.",
      account:
        "Créez un compte gratuit pour sauvegarder vos versions, débloquer les Extensions et les Apps, et exporter votre Constitution en PDF.",
    },
    coachOffer: "20 minutes de coaching offertes",
    coachOfferDetail:
      "avec un coach certifié en Holacracy à la création de votre compte.",
    coachOfferSub: "Coaching premium ensuite à 500 €/h.",
    continueGoogle: "Continuer avec Google",
    orByEmail: "ou par e-mail",
    emailSent:
      "Lien de connexion envoyé. Ouvrez-le depuis votre boîte mail pour vous connecter.",
    emailPlaceholder: "vous@exemple.fr",
    sendLink: "Recevoir un lien",
    accountNotice:
      "Compte gratuit. Avec Google : nom, prénom, e-mail, entreprise.",
    welcome: "Bienvenue",
    lastStep:
      "Dernière étape : votre organisation. Cela nous permet de préparer votre session de coaching offerte.",
    orgName: "Nom de l'entreprise / organisation",
    orgPlaceholder: "Ex. Sémawé",
    continue: "Continuer",
    later: "Plus tard",
    freeSession: "Votre session offerte",
    coachTitle: "20 minutes avec un coach Holacracy",
    coachSubtitle:
      "Choisissez votre coach et réservez un créneau de 20 minutes, offert.",
    bookWith: (name: string) => `Réserver avec ${name}`,
    coachingPricing:
      "Au-delà de la découverte : supervision par un coach senior, 500 €/h ou 3000 €/jour.",
    dateLocale: "fr-FR",
  },
  en: {
    toc: "Contents",
    composerLabel: "Composer",
    gapWarning: (n: number) =>
      `${n} default rule${n > 1 ? "s" : ""} fill${n > 1 ? "" : "s"} inactive modules`,
    activateAll: "Activate all",
    baseLite: "Lite base",
    baseLiteTitle:
      "Reset to the full Lite: all removable blocks checked, no extension or app.",
    coreOnly: "Core only",
    coreOnlyTitle: "Keep only the irreducible core.",
    myVersions: "My versions",
    saving: "Saving...",
    saveVersion: "Save this version",
    saved: "Version saved.",
    saveFailed: "Save failed.",
    limitReached: (max: number) =>
      `Limit of ${max} versions reached: delete one to save.`,
    loaded: (name: string) => `"${name}" loaded.`,
    untitled: "Untitled",
    loginToSave: "Sign in to save your versions.",
    rename: "Rename",
    renamePrompt: "New version name",
    delete: "Delete",
    confirmDelete: (name: string) => `Delete version "${name}"?`,
    loadTitle: "Load this version",
    titleAriaLabel: "Your Constitution title",
    titleHint: "Editable title: give your Constitution a name.",
    fontLabel: "Font",
    logoAdd: "add",
    logoChange: "change",
    logoRemove: "remove",
    colorLabel: "Color",
    colorReset: "default",
    loggedIn: (name: string) => `Signed in as ${name}`,
    activeAccount: "Active account",
    signOut: "sign out",
    freeTierMsg:
      "Core and Full version are free. Account required for Extensions, Apps, and PDF.",
    showIntent: "Show intent notes",
    pdfGenerating: "Generating...",
    pdfDownload: "Download PDF",
    pdfFailed:
      "The PDF could not be produced. Try again; your composition is untouched on screen.",
    defaultRule: (label: string) => `Default rule: “${label}” not enabled`,
    releasePinned: (date: string) =>
      `You are reading this version exactly as you saved it, with the Constitution of ${date}. The Constitution has changed since; this document has not.`,
    releaseNotPinned:
      "This version is an old one: the app did not record which Constitution you composed it with. It is therefore shown with today's Constitution.",
    releasePinAction: "Save it with today's Constitution",
    releaseMigrateAction: "Create a version of it on today's Constitution",
    releaseMigrateName: (name: string, date: string) =>
      `${name} (Constitution of ${date})`,
    releaseMigrated: (name: string) =>
      `“${name}” has been created on today's Constitution. Your original version is untouched.`,
    releaseMigrateFull: (max: number) =>
      `All ${max} of your version slots are taken. Delete one to create this new version; your original version will not be touched.`,
    releaseMissing: (date: string) =>
      `This version was composed with the Constitution of ${date}, which the app no longer has. It was not opened: you would have read a text other than your own.`,
    releaseMismatch: (date: string) =>
      `The Constitution of ${date} kept by the app no longer matches this version. It was not opened, so as not to show you a text that is not yours.`,
    pdfContentRef: (date: string, sha: string) =>
      `Constitution of ${date} · ref. ${sha}`,
    reinsert: (label: string) => `Reinsert: ${label}`,
    addModuleHere: "Add a module here",
    legend: "Legend",
    legendDefaultRule: "Default rule",
    versionsFailed:
      "Your saved versions could not be read. Reload the page: what you see on screen is not lost.",
    versionActionFailed:
      "That version operation failed. Nothing was changed in your account.",
    // Constitution PDF labels
    pdfComposedOn: "Composed on",
    pdfValuesHeading: "Values and principles",
    pdfDefaultRule: (label: string) => `Default rule: “${label}” not enabled`,
    pdfFooter: (license: string, notice: string) =>
      `Composed with Constitution Composer, a Sémawé tool, under the ${license} licence. ${notice}`,
    editionKicker: "Sémawé edition · unofficial version",
    liteFull: "Full Lite",
    blocksRetirable: (kept: number, total: number) =>
      `${kept}/${total} removable blocks`,
    blocksWithAddons: (kept: number, total: number, addons: number) =>
      `${kept}/${total} blocks · ${addons} add-on${addons > 1 ? "s" : ""}`,
    versionLite: "Lite version, complete",
    versionFull: "Full version",
    versionReduced: (n: number) =>
      `Reduced version, ${n} block${n > 1 ? "s" : ""} removed`,
    versionCustom: "Custom version",
    mobilePanel: "Contents & modules",
    mobileActive: (n: number) => `${n} active`,
    mobileCore: "core",
    close: "Close",
    createFreeAccount: "Create your free account",
    gateTitle: {
      pdf: "Download your Constitution",
      save: "Save your versions",
      modules: "Unlock advanced modules",
      account: "Create your free account",
    },
    gateDesc: {
      pdf: "The PDF of your composed Constitution is for members only, account creation is free.",
      save: "Save up to five versions of your Constitution and retrieve them on every visit. Account creation is free.",
      modules:
        "Constitutional Extensions and Apps are for members only. Account creation is free.",
      account:
        "Create a free account to save your versions, unlock Extensions and Apps, and export your Constitution as PDF.",
    },
    coachOffer: "20 minutes of complimentary coaching",
    coachOfferDetail:
      "with a certified Holacracy coach when you create your account.",
    coachOfferSub: "Premium coaching: 500 €/h thereafter.",
    continueGoogle: "Continue with Google",
    orByEmail: "or by email",
    emailSent:
      "Sign-in link sent. Open it from your inbox to sign in.",
    emailPlaceholder: "you@example.com",
    sendLink: "Send link",
    accountNotice: "Free account. With Google: name, email, organization.",
    welcome: "Welcome",
    lastStep:
      "Last step: your organization. This helps us prepare your complimentary coaching session.",
    orgName: "Company / organization name",
    orgPlaceholder: "e.g. Sémawé",
    continue: "Continue",
    later: "Later",
    freeSession: "Your complimentary session",
    coachTitle: "20 minutes with a Holacracy coach",
    coachSubtitle:
      "Choose your coach and book a complimentary 20-minute slot.",
    bookWith: (name: string) => `Book with ${name}`,
    coachingPricing:
      "Beyond onboarding: senior coach supervision, 500 €/h or 3 000 €/day.",
    dateLocale: "en-GB",
  },
};

// Marketplace (App Store tab)
export const MARKETPLACE = {
  fr: {
    beyond: "Au-delà de la Lite",
    title: "App Store",
    subtitle:
      "Des extensions constitutionnelles et des apps à brancher sur votre Constitution. Catalogue en construction, d'autres arrivent.",
    requires: "Nécessite :",
    discover: "Découvrir",
    activate: "Activer →",
    sectionExtensions: "Extensions constitutionnelles",
    sectionExtensionsDesc:
      "Du texte constitutionnel en plus, qui s'intègre dans la Constitution elle-même.",
    sectionApps: "Apps",
    sectionAppsDesc:
      "Des processus à brancher sur la Constitution, au-delà du texte de base.",
    proposeTitle: "Proposer une app",
    proposeDesc:
      "Une idée d'extension ou d'app pour l'App Store ? Proposez-la, on l'étudie.",
    proposeCta: "Proposer une app par e-mail",
    proposeSubject: "Proposition d'app pour l'App Store de la Constitution",
    proposeBody:
      "Bonjour,\n\nJe propose une app / extension pour l'App Store :\n\n- Nom :\n- Ce qu'elle ferait :\n- Pourquoi elle serait utile :\n\nMerci !",
    formName: "Nom de l'app",
    formKind: "Type",
    formKindExtension: "Extension constitutionnelle",
    formKindApp: "App",
    formIntegration: "Où ça s'intègre",
    formIntegrationPlaceholder:
      "Ex. après l'Article 4, ou au niveau du Leader de Cercle…",
    formDescription: "Ce que ça fait",
    formRationale: "Pourquoi ce serait utile",
    formSubmit: "Envoyer ma proposition",
    formSubmitting: "Envoi…",
    formSignIn: "Connectez-vous pour proposer une app.",
    formSignInCta: "Se connecter",
    formThanks:
      "Merci, votre proposition a été envoyée. Vous la retrouvez ci-dessous avec son statut.",
    formError: "Une erreur est survenue. Réessayez.",
    mySubmissions: "Mes propositions",
    statusPending: "En attente",
    statusApproved: "Approuvée",
    statusRejected: "Refusée",
  },
  en: {
    beyond: "Beyond Lite",
    title: "App Store",
    subtitle:
      "Constitutional extensions and apps to plug into your Constitution. Catalogue in progress, more coming.",
    requires: "Requires:",
    discover: "Learn more",
    activate: "Activate →",
    sectionExtensions: "Constitutional extensions",
    sectionExtensionsDesc:
      "Additional constitutional text that integrates into the Constitution itself.",
    sectionApps: "Apps",
    sectionAppsDesc:
      "Processes to plug onto the Constitution, beyond the base text.",
    proposeTitle: "Suggest an app",
    proposeDesc:
      "Have an idea for an extension or app for the App Store? Suggest it and we'll look into it.",
    proposeCta: "Suggest an app by email",
    proposeSubject: "App suggestion for the Constitution App Store",
    proposeBody:
      "Hi,\n\nHere is an app / extension I'd like to suggest for the App Store:\n\n- Name:\n- What it would do:\n- Why it would be useful:\n\nThanks!",
    formName: "App name",
    formKind: "Type",
    formKindExtension: "Constitutional extension",
    formKindApp: "App",
    formIntegration: "Where it plugs in",
    formIntegrationPlaceholder: "e.g. after Article 4, or at the Circle Lead level…",
    formDescription: "What it does",
    formRationale: "Why it would be useful",
    formSubmit: "Send my suggestion",
    formSubmitting: "Sending…",
    formSignIn: "Sign in to suggest an app.",
    formSignInCta: "Sign in",
    formThanks:
      "Thanks, your suggestion was sent. You'll find it below with its status.",
    formError: "Something went wrong. Please try again.",
    mySubmissions: "My suggestions",
    statusPending: "Pending",
    statusApproved: "Approved",
    statusRejected: "Rejected",
  },
};

// Déclaration de Principes (onglet + PDF signable)
export const PRINCIPES_UI = {
  fr: {
    adoptionText:
      "En ratifiant le présent document, les Ratificateurs adoptent l'ensemble indissociable que forment ces Principes et la Constitution comme cadre de gouvernance et d'exploitation de leur organisation. Ils transfèrent leur autorité dans ce que ces Principes et cette Constitution définissent ensemble, et s'engagent à n'exercer le pouvoir qu'à travers les processus qui en découlent. Les Partenaires signataires acceptent d'œuvrer selon ce même cadre.",
    logoAlt: "Logo de l'organisation",
    kept: (n: number) =>
      `${n} principe${n > 1 ? "s" : ""} retenu${n > 1 ? "s" : ""}`,
    generating: "Génération…",
    downloadPdf: "Télécharger le PDF signable",
    saving: "Enregistrement…",
    saved: "Enregistré dans votre compte.",
    saveFailed:
      "Enregistrement impossible : votre Déclaration n'a pas été écrite dans votre compte. Vérifiez votre connexion, puis modifiez un champ pour réessayer.",
    loadFailed:
      "Votre Déclaration n'a pas pu être lue. Elle est intacte dans votre compte : rechargez la page plutôt que de la ressaisir, pour ne pas l'écraser.",
    pdfFailed:
      "Le PDF n'a pas pu être produit. Réessayez ; si cela persiste, dites-le-nous, rien n'est perdu de votre Déclaration.",
    purposeLabel: "Raison d'Être de l'organisation",
    purposePlaceholder:
      "La raison d'être que ces principes servent : quelques lignes.",
    mottoLabel: "Devise",
    mottoPlaceholder: "Une formule courte qui vous rassemble.",
    dragHint: "pour le réordonner ; la numérotation s'adapte.",
    moveUp: (titre: string) => `Remonter « ${titre} »`,
    moveDown: (titre: string) => `Descendre « ${titre} »`,
    keyboardHint:
      "Au clavier : les deux boutons de chaque principe le déplacent d'un rang.",
    dragHintPre: "Glissez un principe par sa poignée",
    dragTitle: "Glisser pour réordonner",
    removedPrinciple: (title: string) => `Principe retiré : « ${title} »`,
    restore: "Rétablir",
    titlePlaceholder: "Titre du principe",
    textPlaceholder: "Énoncé du principe (optionnel)",
    save: "Enregistrer",
    cancel: "Annuler",
    edit: "Éditer",
    remove: "Retirer",
    added: "Principe ajouté",
    confirmRemove: "⚠ Retirer ce principe ?",
    confirmRemoveBtn: "Confirmer le retrait",
    add: "Ajouter",
    addPrinciple: "Ajouter un principe",
    adoption: "Adoption",
    ratifiers: "Ratificateurs",
    signatories: "Signataires",
    namesPlaceholder: "Un nom et prénom par ligne.",
    namesHint:
      "Ces noms apparaîtront avec une ligne de signature dans le PDF de la Déclaration.",
    editionKicker: "Édition Sémawé · version non officielle",
    footer: (license: string, notice: string) =>
      `Déclaration de Principes composée avec Constitution Composer, un outil Sémawé, sous licence ${license}. ${notice}`,
    attachTitle: "Cette Déclaration n'est pas encore rattachée à votre compte.",
    attachBody:
      "Elle a été rédigée avant votre connexion, sur ce navigateur. Voulez-vous l'enregistrer dans votre compte, ou repartir d'une Déclaration vierge ?",
    attachKeep: "Enregistrer dans mon compte",
    attachReset: "Repartir de zéro",
    gateTitle: "Téléchargez votre Déclaration",
    gateDesc:
      "Le PDF signable de votre Déclaration de Principes est réservé aux membres, la création de compte est gratuite.",
    // PDF
    pdfComposedOn: "Composé le",
    pdfPurpose: "Raison d'Être",
    pdfMotto: "Devise",
    pdfRatifiers: "Ratificateurs",
    pdfSignatories: "Partenaires signataires",
    pdfSignature: "Signature",
    pdfDate: "Date",
  },
  en: {
    adoptionText:
      "By ratifying this document, the Ratifiers adopt the indivisible whole formed by these Principles and the Constitution as the framework for governing and operating their organization. They transfer their authority into what these Principles and this Constitution define together, and undertake to exercise power only through the processes arising from them. The signing Partners agree to work within that same framework.",
    logoAlt: "Organization logo",
    kept: (n: number) => `${n} principle${n > 1 ? "s" : ""} kept`,
    generating: "Generating…",
    downloadPdf: "Download the signable PDF",
    saving: "Saving…",
    saved: "Saved to your account.",
    saveFailed:
      "Could not save: your Declaration was not written to your account. Check your connection, then edit a field to retry.",
    loadFailed:
      "Your Declaration could not be read. It is untouched in your account: reload the page rather than retyping it, so you do not overwrite it.",
    pdfFailed:
      "The PDF could not be produced. Try again; if it keeps failing, tell us — nothing is lost from your Declaration.",
    purposeLabel: "Purpose of the organization",
    purposePlaceholder: "The purpose these principles serve: a few lines.",
    mottoLabel: "Motto",
    mottoPlaceholder: "A short phrase that brings you together.",
    dragHintPre: "Drag a principle by its handle",
    dragHint: "to reorder it; numbering adapts.",
    moveUp: (titre: string) => `Move “${titre}” up`,
    moveDown: (titre: string) => `Move “${titre}” down`,
    keyboardHint:
      "With a keyboard: the two buttons on each principle move it one rank.",
    dragTitle: "Drag to reorder",
    removedPrinciple: (title: string) => `Principle removed: “${title}”`,
    restore: "Restore",
    titlePlaceholder: "Principle title",
    textPlaceholder: "Principle statement (optional)",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    remove: "Remove",
    added: "Added principle",
    confirmRemove: "⚠ Remove this principle?",
    confirmRemoveBtn: "Confirm removal",
    add: "Add",
    addPrinciple: "Add a principle",
    adoption: "Adoption",
    ratifiers: "Ratifiers",
    signatories: "Signatories",
    namesPlaceholder: "One first and last name per line.",
    namesHint:
      "These names will appear with a signature line in the Declaration PDF.",
    editionKicker: "Sémawé edition · unofficial version",
    footer: (license: string, notice: string) =>
      `Declaration of Principles composed with Constitution Composer, a Sémawé tool, under the ${license} licence. ${notice}`,
    attachTitle: "This Declaration is not attached to your account yet.",
    attachBody:
      "It was drafted before you signed in, on this browser. Would you like to save it to your account, or start from a blank Declaration?",
    attachKeep: "Save to my account",
    attachReset: "Start over",
    gateTitle: "Download your Declaration",
    gateDesc:
      "The signable PDF of your Declaration of Principles is for members only, account creation is free.",
    // PDF
    pdfComposedOn: "Composed on",
    pdfPurpose: "Purpose",
    pdfMotto: "Motto",
    pdfRatifiers: "Ratifiers",
    pdfSignatories: "Signing Partners",
    pdfSignature: "Signature",
    pdfDate: "Date",
  },
} satisfies Record<Locale, unknown>;

// Glossaire tab
export const GLOSSAIRE_UI = {
  fr: { definedTerms: "Termes définis" },
  en: { definedTerms: "Defined terms" },
};

// IntroBanner
export const INTRO_BANNER = {
  fr: {
    ariaLabel: "Présentation de l'outil",
    ariaClose: "Masquer la présentation",
    title: "Composez la Constitution de votre organisation",
    body: "Cet outil assemble une Constitution sur mesure : un socle complet, des blocs que vous conservez ou retirez, des extensions que vous activez au fil du texte. Le résultat s'exporte en PDF prêt à ratifier, à l'identité de votre organisation. Le texte est une édition Sémawé, dérivée de la Constitution Holacracy 5.0 : ce n'est pas une version officielle.",
    howTitle: "Comment ça marche",
    steps: [
      "Lisez le texte : le socle est déjà en place, chaque module se coche ou se décoche à l'endroit où il s'insère.",
      "Complétez la Déclaration de Principes et l'identité visuelle (logo, police, couleur) dans les autres onglets.",
      "Créez un compte gratuit pour activer les extensions, sauvegarder vos versions et exporter le PDF.",
    ],
  },
  en: {
    ariaLabel: "Tool introduction",
    ariaClose: "Dismiss introduction",
    title: "Compose your organization's Constitution",
    body: "This tool assembles a custom Constitution: an irreducible core, blocks you keep or remove, extensions you activate as you read. The result exports as a PDF ready to ratify, with your organization's identity. The text is a Sémawé edition derived from the Holacracy Constitution 5.0: it is not an official version.",
    howTitle: "How it works",
    steps: [
      "Read the text: the core is already in place; each module can be checked or unchecked right where it inserts.",
      "Complete the Declaration of Principles and visual identity (logo, font, color) in the other tabs.",
      "Create a free account to activate extensions, save your versions, and export the PDF.",
    ],
  },
};
