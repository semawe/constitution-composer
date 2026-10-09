// Notification Slack des nouveaux comptes (0005, 0006), par webhook entrant
// validé (modèle : app-erp, src/lib/connecteurs/slack-conges.ts).
//
// Envoyée par le serveur après la transaction : une notification en échec ne
// fait jamais échouer l'inscription. Le registre composer.annonces_slack, tenu
// dans la transaction, garantit l'unicité par compte.

export interface ConfigurationSlack {
  webhookUrl: string;
}

export type Fetcher = (entree: string, init?: RequestInit) => Promise<Response>;

export function configurationSlack(valeur: string | undefined): ConfigurationSlack | null {
  const brute = valeur?.trim();
  if (!brute) return null;
  const url = new URL(brute);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "hooks.slack.com" ||
    !/^\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("SLACK_WEBHOOK_URL n'est pas une URL de webhook Slack valide.");
  return { webhookUrl: url.toString() };
}

/**
 * Texte inerte (0006, private.slack_text) : sauts de ligne aplatis, longueur
 * bornée, puis `& < >` échappés — plus de `<!channel>` ni de lien injectable.
 */
export function texteSlack(brut: string | null | undefined, max = 120): string {
  return (brut ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, max)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function messageInscription(nom: string | null, email: string): string {
  const affiche = nom?.trim() || email.split("@")[0];
  return `:new: *${texteSlack(affiche)}* (${texteSlack(email)}) a créé son compte sur Constitution Composer.`;
}

export function messageOrganisation(nom: string | null, email: string, organisation: string): string {
  return (
    `:office: ${texteSlack(nom?.trim() || email)} (${texteSlack(email)}) — ` +
    `organisation : *${texteSlack(organisation)}*.`
  );
}

/** Publie ; ne lève jamais. Rend true si Slack a accepté. */
export async function publierSlack(
  config: ConfigurationSlack | null,
  message: string,
  fetcher: Fetcher,
  journal: (evenement: string, champs?: Record<string, unknown>) => void,
): Promise<boolean> {
  if (!config) return false;
  try {
    const reponse = await fetcher(config.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: message }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const corps = (await reponse.text()).trim();
    if (!reponse.ok || corps !== "ok") {
      journal("slack.refus", { statut: reponse.status });
      return false;
    }
    return true;
  } catch (erreur) {
    journal("slack.echec", { message: (erreur as Error).message });
    return false;
  }
}
