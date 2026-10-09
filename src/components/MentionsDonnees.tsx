import { BACKEND_CHOISI } from "@/lib/backend";
import type { Locale } from "@/lib/i18n";

// Ce que les mentions légales disent de l'hébergement des comptes, selon le
// backend que le build embarque.
//
// Le texte suit le build et non le calendrier : tant que la production tourne
// sur Supabase (jusqu'à la bascule, tâche ERP 3053), un build Supabase doit
// continuer de nommer Supabase comme sous-traitant ; un build « serveur » dit
// que tout est chez Sémawé. Les deux textes partent ainsi en ligne avec le
// backend qu'ils décrivent, jamais avant.

const TEXTES = {
  fr: {
    hebergement:
      "Le site, les comptes et les documents enregistrés sont hébergés par Sémawé, sur un serveur loué à OVH et situé en France.",
    serveur: [
      "La création d’un compte collecte une adresse électronique et, le cas échéant, un nom et une organisation. Ces données servent à l’authentification et à la conservation de vos compositions, et à rien d’autre sans votre accord. Elles ne sont ni vendues ni cédées à des tiers.",
      "Elles sont conservées par Sémawé sur son propre serveur, en France, et sauvegardées chaque nuit. Ces sauvegardes, chiffrées, sont conservées quatre-vingt-dix jours chez Backblaze (région Europe), en qualité de sous-traitant. Le lien de connexion reçu par courriel est envoyé par Brevo (Sendinblue SAS, France), en qualité de sous-traitant. La connexion par Google n’a lieu que si vous la choisissez ; Google transmet alors votre adresse et votre nom. L’équipe de Sémawé est prévenue de chaque nouveau compte (nom et adresse) dans sa messagerie interne, Slack.",
      "La session est tenue par un cookie strictement nécessaire, que les scripts de la page ne peuvent pas lire.",
      "Si vous cochez, à la connexion, la case « Recevoir les nouvelles du Constitution Composer », votre adresse, et elle seule, est ajoutée à une liste de diffusion de Sémawé tenue chez Brevo ; la date de votre accord est conservée. La case est facultative et décochée par défaut. Chaque envoi porte un lien de désinscription, qui retire votre accord sans toucher à votre compte.",
    ],
    supabase: [
      "La création d’un compte collecte une adresse électronique et, le cas échéant, un nom et une organisation. Ces données servent exclusivement à l’authentification et à la conservation de vos compositions. Elles ne sont ni vendues ni cédées à des tiers. Le stockage et l’authentification sont assurés par Supabase, en qualité de sous-traitant.",
    ],
  },
  en: {
    hebergement:
      "The site, the accounts and the saved documents are hosted by Sémawé, on a server rented from OVH and located in France.",
    serveur: [
      "Creating an account collects an email address and, where provided, a name and an organisation. This data is used to authenticate you and to store your compositions, and for nothing else without your consent. It is neither sold nor shared with third parties.",
      "It is kept by Sémawé on its own server, in France, and backed up every night. These encrypted backups are kept for ninety days by Backblaze (Europe region), acting as a processor. The sign-in link you receive by email is sent by Brevo (Sendinblue SAS, France), acting as a processor. Signing in with Google only happens if you choose it; Google then shares your email address and name. The Sémawé team is notified of each new account (name and address) in its internal messaging tool, Slack.",
      "Your session is held by a strictly necessary cookie, which the page’s scripts cannot read.",
      "If you tick “Receive Constitution Composer news” when signing in, your email address, and nothing else, is added to a Sémawé mailing list held at Brevo; the date of your consent is kept. The box is optional and unticked by default. Every mailing carries an unsubscribe link, which withdraws your consent without affecting your account.",
    ],
    supabase: [
      "Creating an account collects an email address and, where provided, a name and an organisation. This data is used solely to authenticate you and to store your compositions. It is neither sold nor shared with third parties. Storage and authentication are handled by Supabase, acting as a processor.",
    ],
  },
} as const;

/** La ligne sur l'hébergement des comptes, ou rien pour un build Supabase. */
export function HebergementComptes({ locale }: { locale: Locale }) {
  if (BACKEND_CHOISI.type === "supabase") return null;
  return <p className="pt-2">{TEXTES[locale].hebergement}</p>;
}

/** Les paragraphes sur les données des comptes. */
export function DonneesComptes({ locale }: { locale: Locale }) {
  const paragraphes =
    BACKEND_CHOISI.type === "supabase" ? TEXTES[locale].supabase : TEXTES[locale].serveur;
  return (
    <>
      {paragraphes.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </>
  );
}

export { TEXTES as TEXTES_MENTIONS_DONNEES };
