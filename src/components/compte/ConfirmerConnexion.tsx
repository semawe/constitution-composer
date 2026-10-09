"use client";

import { useEffect, useMemo, useState } from "react";
import { getService } from "@/lib/service";
import type { Locale } from "@/lib/i18n";
import { useConnexion } from "./useConnexion";
import { TEXTES_CONFIRMATION as TEXTES, type Motif } from "./confirmer-textes";

// La page où mène le lien reçu par courriel.
//
// Elle ne fait rien à l'ouverture : les messageries et leurs robots ouvrent les
// liens, ils ne soumettent pas les formulaires. Le jeton est lu dans l'adresse,
// retiré de l'historique, et ne part au service que sur le clic de la personne,
// par l'envoi d'un formulaire (POST, même origine). Le service connecte, puis
// ramène sur la page d'où la demande était partie ; en cas de refus, il revient
// ici avec le motif (`?erreur=`).

const RE_JETON = /^[A-Za-z0-9_-]{43}$/;

/** Ce que l'adresse de la page dit, lu une fois puis retiré de l'historique. */
export function lireAdresse(recherche: string): { jeton: string | null; motif: Motif | null } {
  const params = new URLSearchParams(recherche);
  const erreur = params.get("erreur");
  if (erreur) {
    return {
      jeton: null,
      motif: erreur === "NAVIGATEUR" || erreur === "LIEN_INVALIDE" ? erreur : "AUTRE",
    };
  }
  const jeton = params.get("jeton");
  if (jeton && RE_JETON.test(jeton)) return { jeton, motif: null };
  return { jeton: null, motif: "INCOMPLET" };
}

export default function ConfirmerConnexion({ locale }: { locale: Locale }) {
  const t = TEXTES[locale];
  const service = useMemo(() => getService(), []);
  const [lu, setLu] = useState<{ jeton: string | null; motif: Motif | null } | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    const adresse = lireAdresse(window.location.search);
    // Le jeton ne reste ni dans l'adresse affichée, ni dans l'historique.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    // Lu dans l'adresse après montage : le rendu prérendu ne le connaît pas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLu(adresse);
  }, []);

  const connexion = useConnexion({
    service,
    onAvantRedirection: () => {},
    onSimulee: () => {},
    // Le nouveau lien ramènera au Composer, pas sur cette page.
    retour: () => window.location.origin + t.composer,
  });

  const lien = (
    <a href={t.composer} className="text-accent-text underline transition hover:text-teal-800">
      {t.retour}
    </a>
  );

  if (!service)
    return (
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-body">{t.indisponible}</p>
        <p className="text-sm">{lien}</p>
      </div>
    );

  if (!lu) return null;

  if (lu.jeton)
    return (
      <form
        method="post"
        action="/api/connexion/lien/consommer"
        onSubmit={() => setEnvoiEnCours(true)}
        className="space-y-6"
      >
        <p className="text-sm leading-relaxed text-body">{t.confirmer}</p>
        <input type="hidden" name="jeton" value={lu.jeton} />
        <input type="hidden" name="langue" value={locale} />
        <button
          type="submit"
          disabled={envoiEnCours}
          className="rounded-lg btn-ink px-5 py-2.5 text-sm font-medium transition disabled:opacity-50"
        >
          {envoiEnCours ? t.enCours : t.bouton}
        </button>
      </form>
    );

  const { email, setEmail, envoi, signInOtp } = connexion;
  return (
    <div className="space-y-6">
      <p role="alert" className="text-sm leading-relaxed text-body">
        {t.motifs[lu.motif ?? "AUTRE"]}
      </p>
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          {t.redemander}
        </h2>
        {envoi === "envoye" ? (
          <p role="status" className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-teal-800">
            {t.envoye}
          </p>
        ) : (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void signInOtp();
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.exemple}
              aria-label={t.adresse}
              autoComplete="email"
              className="min-w-0 flex-1 rounded-lg border border-field px-3 py-2 text-sm outline-none transition focus:border-field-accent"
            />
            <button
              type="submit"
              disabled={!email.trim() || envoi === "encours"}
              className="shrink-0 rounded-lg btn-ink px-3 py-2 text-sm font-medium transition disabled:opacity-50"
            >
              {envoi === "encours" ? t.envoi : t.envoyer}
            </button>
          </form>
        )}
        {envoi === "echec" && (
          <p role="alert" className="mt-2 text-xs text-danger-text">
            {t.echec}
          </p>
        )}
      </section>
      <p className="text-sm">{lien}</p>
    </div>
  );
}

