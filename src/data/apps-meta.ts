// Métadonnées éditoriales enrichies des apps et extensions constitutionnelles.
// Indépendant du schéma constitution.fr.json : contenu de vulgarisation, exemples,
// provenance :à maintenir ici, pas dans le JSON de fond.

export interface AppMeta {
  id: string;
  tagline: string;
  longDescription: string;
  origin: string;
  creator: string;
  organizations: string[];
  examples: string[];
  certified: boolean;
  certifier?: string;
}

const META: AppMeta[] = [
  {
    id: "focus",
    tagline: "Préciser la portée d'un Rôle à un contexte ou à des conditions particulières.",
    longDescription:
      "Sans l'extension Focus, chaque affectation de Rôle vaut pour la totalité de son périmètre. Focus permet au Leader de Cercle de restreindre une affectation à un contexte spécifique : un client, un projet, une période, une géographie. Le Partenaire tient alors le Rôle uniquement dans ce cadre, sans empiéter sur le reste. Utile quand plusieurs Partenaires se partagent un même Rôle sur des segments différents, ou quand un Rôle est confié à mi-temps sur un périmètre délimité.",
    origin:
      "Issu de la pratique Holacracy avancée, le Focus répond à un besoin fréquent dans les organisations de taille intermédiaire où les Rôles sont partagés entre Partenaires.",
    creator: "HolacracyOne",
    organizations: [
      "Sémawé",
      "Organisations de conseil en transformation organisationnelle",
    ],
    examples: [
      "Un Partenaire tient le Rôle «Commercial» avec le Focus «Région Sud» ; un autre le tient avec le Focus «Grands comptes».",
      "Un Rôle «Coach interne» est assigné avec le Focus «Équipe technique» uniquement.",
    ],
    certified: false,
  },
  {
    id: "representant-cercle",
    tagline: "Élire un représentant qui porte les Tensions du Cercle vers son Super-Cercle.",
    longDescription:
      "Par défaut, la Constitution v6 ne prévoit pas de remontée formelle des Tensions depuis un Cercle vers son Super-Cercle. L'extension Représentant de Cercle ajoute ce rôle élu : choisi par le Cercle lui-même via le Processus d'Élection Intégrative, il siège aux Réunions de Gouvernance du Super-Cercle pour y porter les préoccupations qui dépassent le Cercle. C'est un mécanisme de tension ascendante, symétrique au Lead Link descendant.",
    origin:
      "Présent dans les versions antérieures de la Constitution Holacracy, il a été rendu optionnel en v6 pour alléger les structures plates. Cette extension le réintroduit explicitement pour les organisations qui en ont besoin.",
    creator: "HolacracyOne",
    organizations: [
      "Organisations Holacracy avec plusieurs niveaux de cercles imbriqués",
      "Coopératives et SCOP en gouvernance distribuée",
    ],
    examples: [
      "Le Cercle «Produit» élit un Représentant qui siège aux réunions du Cercle «Général» pour y remonter les blocages liés aux ressources.",
      "Un Représentant alerte le Super-Cercle qu'une politique globale freine l'autonomie de son Cercle.",
    ],
    certified: false,
  },
  {
    id: "agents",
    tagline: "Confier un Rôle à un système d'IA ou à un agent logiciel autonome.",
    longDescription:
      "Cette extension ouvre la Constitution aux agents non humains. Un Agent (système logiciel, assistant IA ou automate) peut tenir un Rôle avec les mêmes droits et contraintes qu'un Partenaire humain, sous réserve que son garant humain (Lead Link ou Partenaire désigné) assume la redevabilité de ses actes. L'Agent agit dans les limites de son Rôle ; il ne peut ni participer à la Gouvernance ni voter. Conçue pour les organisations qui automatisent des fonctions opérationnelles tout en maintenant une gouvernance humaine.",
    origin:
      "Extension expérimentale développée en réponse à l'essor des systèmes IA autonomes dans les organisations. Elle adapte le cadre constitutionnel sans en rompre la cohérence.",
    creator: "Sémawé / Heterostasia",
    organizations: [
      "Sémawé (en cours d'expérimentation)",
      "Organisations pionnières en gouvernance IA",
    ],
    examples: [
      "Un agent IA tient le Rôle «Veille concurrentielle» : il produit des rapports hebdomadaires dans le périmètre défini, sans intervention humaine au quotidien.",
      "Un automate de facturation tient le Rôle «Émission des factures» sous la redevabilité du Lead Link Finance.",
    ],
    certified: false,
  },
  {
    id: "revue-appreciative",
    tagline: "Instaurer une pratique régulière de reconnaissance et de feedback entre Partenaires.",
    longDescription:
      "La Revue appréciative est une App constitutionnelle qui ajoute à la gouvernance du Cercle un processus structuré de feedback positif et constructif entre Partenaires. À intervalles réguliers, chaque Partenaire reçoit des retours sur ce qu'il apporte au Cercle et sur ce qui pourrait être amplifié. Ce n'est pas une évaluation de performance au sens RH : c'est un espace de reconnaissance mutuelle, ancré dans les Rôles réels tenus, qui renforce la cohésion sans court-circuiter les Tensions de Gouvernance.",
    origin:
      "Développée à partir des pratiques de reconnaissance issues du coaching d'équipe et adaptées à la structure holacratique. Inspirée des travaux sur la psychologie positive appliquée aux organisations.",
    creator: "Sémawé",
    organizations: [
      "Sémawé",
      "Cabinets de conseil en développement organisationnel",
    ],
    examples: [
      "Chaque trimestre, les Partenaires du Cercle se réunissent 45 minutes : chacun reçoit 2-3 retours appréciatifsancrés dans ses Rôles.",
      "Un Partenaire qui tient le Rôle «Facilitateur» reçoit un retour sur l'impact de ses facilitations sur la qualité des décisions collectives.",
    ],
    certified: false,
  },
  {
    id: "decision-remunerations",
    tagline: "Décider collectivement des rémunérations par un processus pair-à-pair structuré.",
    longDescription:
      "Cette App ajoute à la Constitution un processus dédié à la décision des rémunérations, distinct du Processus de Gouvernance standard. Chaque Partenaire auto-évalue sa contribution, ses pairs fournissent un retour structuré, et une décision émerge par consentement selon des ratios et des critères définis en Gouvernance. L'App ne fixe pas les montants : elle fixe le processus. Elle s'adresse aux organisations qui veulent dépasser la décision unilatérale du manager tout en évitant le consensus mou.",
    origin:
      "Inspirée des pratiques de rémunération pair-à-pair développées dans les SCOP et les organisations libérées, adaptées à la structure holacratique formelle.",
    creator: "Sémawé",
    organizations: [
      "Sémawé (prototype en cours)",
      "SCOP et coopératives en gouvernance partagée",
      "Organisations libérées avec transparence salariale",
    ],
    examples: [
      "Chaque année, chaque Partenaire soumet une auto-évaluation de sa contribution. Ses pairs répondent par une grille structurée. Le Cercle Général décide par consentement dans une fourchette.",
      "Un Partenaire qui a pris davantage de Rôles dans l'année peut proposer une révision de sa rémunération via ce processus, sans passer par la hiérarchie.",
    ],
    certified: false,
  },
];

export const appsMeta: Record<string, AppMeta> = Object.fromEntries(
  META.map((m) => [m.id, m]),
);

export function getAppMeta(id: string): AppMeta | undefined {
  return appsMeta[id];
}

export const appIds = META.map((m) => m.id);
