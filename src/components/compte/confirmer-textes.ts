// Les textes de la page de confirmation d'un lien de connexion, en français et
// en anglais. Hors du composant client : les pages (composants serveur) en lisent
// le titre, et un module « use client » ne leur rendrait qu'une référence.

export type Motif = "NAVIGATEUR" | "LIEN_INVALIDE" | "AUTRE" | "INCOMPLET";

export const TEXTES_CONFIRMATION = {
  fr: {
    titre: "Connexion au Constitution Composer",
    confirmer:
      "Pour terminer la connexion, confirmez d'un clic. Rien ne se passe tant que vous n'avez pas cliqué.",
    bouton: "Se connecter",
    enCours: "Connexion…",
    motifs: {
      NAVIGATEUR:
        "Ce lien a été ouvert dans un autre navigateur que celui où vous l'avez demandé. Par sécurité, il ne sert que dans ce navigateur-là : ouvrez-le là-bas, ou demandez ici un nouveau lien.",
      LIEN_INVALIDE:
        "Ce lien a expiré ou a déjà servi. Un lien de connexion vaut 30 minutes et ne sert qu'une fois : demandez-en un nouveau.",
      AUTRE: "La connexion n'a pas pu aboutir. Demandez un nouveau lien.",
      INCOMPLET:
        "Ce lien est incomplet. Ouvrez-le tel qu'il figure dans le courriel, ou demandez-en un nouveau.",
    } satisfies Record<Motif, string>,
    redemander: "Recevoir un nouveau lien, dans ce navigateur",
    adresse: "Votre adresse électronique",
    exemple: "vous@organisation.fr",
    envoyer: "Envoyer le lien",
    envoi: "Envoi…",
    envoye:
      "Lien envoyé. Ouvrez-le dans ce navigateur-ci, dans les 30 minutes.",
    echec: "L'envoi n'a pas pu se faire. Réessayez dans un instant.",
    indisponible:
      "La connexion n'est pas disponible dans cette version de démonstration du site.",
    retour: "Revenir au Composer",
    composer: "/composer",
  },
  en: {
    titre: "Sign in to Constitution Composer",
    confirmer:
      "To finish signing in, confirm with one click. Nothing happens until you click.",
    bouton: "Sign in",
    enCours: "Signing in…",
    motifs: {
      NAVIGATEUR:
        "This link was opened in a different browser from the one where you requested it. For your security it only works there: open it in that browser, or request a new link here.",
      LIEN_INVALIDE:
        "This link has expired or has already been used. A sign-in link is valid for 30 minutes and works only once: request a new one.",
      AUTRE: "Signing in did not work. Request a new link.",
      INCOMPLET:
        "This link is incomplete. Open it exactly as it appears in the email, or request a new one.",
    } satisfies Record<Motif, string>,
    redemander: "Get a new link, in this browser",
    adresse: "Your email address",
    exemple: "you@organisation.org",
    envoyer: "Send the link",
    envoi: "Sending…",
    envoye: "Link sent. Open it in this browser, within 30 minutes.",
    echec: "The link could not be sent. Try again in a moment.",
    indisponible: "Sign-in is not available in this demonstration version of the site.",
    retour: "Back to the Composer",
    composer: "/en/composer",
  },
} as const;
