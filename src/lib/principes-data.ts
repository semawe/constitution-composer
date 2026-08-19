// Forme du fond des Principes, hors du composant qui l'affiche.
//
// Vit ici pour être importable par l'index des releases archivées, qui ne peut
// pas dépendre d'un composant client : un type ne doit pas obliger un fichier de
// données à tirer React derrière lui.

export interface Principle {
  id: string;
  n: string;
  title: string;
  text: string;
  warning: string;
}

export interface PrincipesData {
  meta: Record<string, string>;
  intro: string;
  principles: Principle[];
}
