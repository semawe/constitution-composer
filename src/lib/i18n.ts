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
      "Coeur et Intégrale en accès libre. Compte requis pour les Extensions, les Apps et le PDF.",
    showIntent: "Afficher les notes d'intention",
    pdfGenerating: "Génération...",
    pdfDownload: "Télécharger le PDF",
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
    },
    gateDesc: {
      pdf: "Le PDF de votre Constitution composée est réservé aux membres, la création de compte est gratuite.",
      save: "Enregistrez jusqu'à cinq versions de votre Constitution et retrouvez-les à chaque visite. La création de compte est gratuite.",
      modules:
        "Les Extensions constitutionnelles et les Apps sont réservées aux membres. La création de compte est gratuite.",
    },
    coachOffer: "30 minutes de coaching offertes",
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
    coachTitle: "30 minutes avec un coach Holacracy",
    coachSubtitle:
      "Choisissez votre coach et réservez un créneau de 30 minutes, offert.",
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
    },
    gateDesc: {
      pdf: "The PDF of your composed Constitution is for members only, account creation is free.",
      save: "Save up to five versions of your Constitution and retrieve them on every visit. Account creation is free.",
      modules:
        "Constitutional Extensions and Apps are for members only. Account creation is free.",
    },
    coachOffer: "30 minutes of complimentary coaching",
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
    coachTitle: "30 minutes with a Holacracy coach",
    coachSubtitle:
      "Choose your coach and book a complimentary 30-minute slot.",
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
  },
  en: {
    beyond: "Beyond Lite",
    title: "App Store",
    subtitle:
      "Constitutional extensions and apps to plug into your Constitution. Catalogue in progress, more coming.",
    requires: "Requires:",
    discover: "Learn more",
    activate: "Activate →",
  },
};

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
    body: "Cet outil assemble une Constitution Holacracy v6 sur mesure : un socle complet, des blocs que vous conservez ou retirez, des extensions que vous activez au fil du texte. Le résultat s'exporte en PDF prêt à ratifier, à l'identité de votre organisation.",
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
    body: "This tool assembles a custom Holacracy v6 Constitution: an irreducible core, blocks you keep or remove, extensions you activate as you read. The result exports as a PDF ready to ratify, with your organization's identity.",
    howTitle: "How it works",
    steps: [
      "Read the text: the core is already in place; each module can be checked or unchecked right where it inserts.",
      "Complete the Declaration of Principles and visual identity (logo, font, color) in the other tabs.",
      "Create a free account to activate extensions, save your versions, and export the PDF.",
    ],
  },
};
