// Ce que le déploiement décide et fait, séparé de la ligne de commande.
//
// `deploy-ovh.mjs` était un script d'un seul tenant : pour éprouver une de ses
// gardes, il fallait le lancer, et le lancer déployait. Ce module porte ce qui
// peut s'éprouver sans toucher à l'hébergement — la lecture de la marque de
// backend, la vérification de la clé du serveur, la publication elle-même
// (contre n'importe quel client qui parle comme `ssh2-sftp-client`), et le
// report des fragments d'une génération sur la suivante.
//
// Issu de l'audit adverse du 04/10/2026 (F05, F08, F16).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// F05 — ce que le build embarque comme backend
// ---------------------------------------------------------------------------

/** La marque `cc-backend` d'une page exportée, ou null si elle n'en porte pas. */
export function lireMarqueBackend(html) {
  const balise = html.match(/<meta\b[^>]*\bname="cc-backend"[^>]*>/i)?.[0];
  if (!balise) return null;
  return balise.match(/\bcontent="([^"]*)"/i)?.[1] ?? null;
}

/** Tous les fichiers d'un dossier, en chemins relatifs à ce dossier. */
export function listerFichiers(racine, sous = '') {
  const dossier = sous ? join(racine, sous) : racine;
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const relatif = sous ? `${sous}/${e.name}` : e.name;
    return e.isDirectory() ? listerFichiers(racine, relatif) : [relatif];
  });
}

/**
 * Le build porte-t-il un backend ? La réponse se lit dans l'HTML exporté, où
 * chaque page dit ce que le build embarque (`serveur`, `supabase:<hôte>` ou
 * `demo`).
 *
 * `familles` dit ce que la cible sait servir : le mutualisé n'a que Supabase
 * (`deploy-ovh.mjs`), l'instance n'a que le service des comptes
 * (`deploy-instance.mjs`). Un build pour l'une, posé sur l'autre, aurait un
 * site qui s'affiche et des comptes qui ne répondent pas.
 *
 * L'ancienne garde cherchait la sous-chaîne `.supabase.co` dans le bundle. Le
 * SDK Supabase la contient de lui-même : un build de démonstration, sans URL ni
 * clé de projet, passait pour un build configuré, et le site publié annonçait
 * des comptes et des sauvegardes qui n'existaient que dans le navigateur.
 *
 * La marque dit ce que le build *embarque*. Elle ne prouve pas que le projet
 * répond : une clé publique présente n'est pas un backend qui fonctionne.
 */
export function jugerBackend(
  out,
  { autoriserDemo = false, attendu = '', familles = ['supabase', 'serveur'] } = {},
) {
  const pages = listerFichiers(out).filter((f) => f.endsWith('.html'));
  if (pages.length === 0)
    return { ok: false, message: `aucune page HTML dans ${out}.` };

  const marques = new Map();
  const sansMarque = [];
  for (const page of pages) {
    const marque = lireMarqueBackend(readFileSync(join(out, page), 'utf8'));
    if (marque === null) sansMarque.push(page);
    else marques.set(marque, (marques.get(marque) ?? 0) + 1);
  }
  if (sansMarque.length)
    return {
      ok: false,
      message:
        `${sansMarque.length} page(s) de out/ ne disent pas quel backend le ` +
        `build embarque (${sansMarque.slice(0, 3).join(', ')}` +
        `${sansMarque.length > 3 ? ', …' : ''}). Le build est antérieur à ` +
        'cette marque, ou incomplet : relance `npm run build`.',
    };
  if (marques.size > 1)
    return {
      ok: false,
      message:
        'les pages de out/ ne s’accordent pas sur le backend embarqué (' +
        [...marques.keys()].join(', ') +
        '). out/ mélange deux builds : relance `npm run build`.',
    };

  const [marque] = marques.keys();
  if (marque === 'demo') {
    if (!autoriserDemo)
      return {
        ok: false,
        message:
          'le build de out/ est un build de démonstration — compte simulé et ' +
          'sauvegardes dans le navigateur, rien qui suive un compte. Rebuild ' +
          'avec le backend de la cible (NEXT_PUBLIC_BACKEND=serveur pour ' +
          'l’instance, NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
          'pour le mutualisé), ou assume la démonstration avec ALLOW_DEMO_DEPLOY=yes.',
      };
    return {
      ok: true,
      demo: true,
      message:
        'DÉMONSTRATION assumée (ALLOW_DEMO_DEPLOY=yes) : le site publié n’aura ' +
        'ni comptes ni sauvegardes distantes.',
    };
  }

  const chunks = join(out, '_next', 'static', 'chunks');
  const bundle = () =>
    listerFichiers(chunks)
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(join(chunks, f), 'utf8'));

  if (marque === 'serveur') {
    if (!familles.includes('serveur'))
      return {
        ok: false,
        message:
          'le build de out/ parle au service des comptes de l’instance (marque ' +
          '« serveur »), que cette cible n’héberge pas : sur elle, connexion, ' +
          'versions et Déclarations répondraient 404. Rebuild avec le backend ' +
          `de cette cible (${familles.join(', ')}).`,
      };
    // Le bundle doit dire la même chose que l'HTML : l'adaptateur HTTP, et
    // aucune adresse de projet Supabase.
    const fragments = bundle();
    if (!fragments.some((js) => js.includes('/api/session')))
      return {
        ok: false,
        message:
          'l’HTML annonce le service des comptes, mais aucun fragment ' +
          'JavaScript de out/ ne l’appelle. out/ est incohérent : relance ' +
          '`npm run build`.',
      };
    const supabase = fragments
      .map((js) => js.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/)?.[0])
      .find(Boolean);
    if (supabase)
      return {
        ok: false,
        message:
          `le build annonce le service des comptes, mais embarque encore ${supabase}. ` +
          'out/ mélange deux backends : relance `npm run build` avec ' +
          'NEXT_PUBLIC_BACKEND=serveur.',
      };
    return {
      ok: true,
      demo: false,
      hote: 'serveur',
      message:
        'Backend embarqué : le service des comptes de l’instance, même origine ' +
        '(ce que le build porte, pas une preuve que le service répond).',
    };
  }

  const hote = marque.match(/^supabase:([a-z0-9.-]+)$/i)?.[1];
  if (!hote)
    return { ok: false, message: `marque de backend illisible : « ${marque} ».` };
  if (!familles.includes('supabase'))
    return {
      ok: false,
      message:
        `le build de out/ embarque Supabase (${hote}), alors que cette cible ` +
        'sert le service des comptes de l’instance. Rebuild avec ' +
        'NEXT_PUBLIC_BACKEND=serveur.',
    };
  if (attendu && hote !== attendu)
    return {
      ok: false,
      message:
        `le build embarque le backend ${hote}, alors que DEPLOY_EXPECT_BACKEND ` +
        `attend ${attendu}. Ce n'est pas le projet de production.`,
    };
  // La marque vient de l'HTML ; le bundle doit dire la même chose, sinon les
  // deux ne sortent pas du même build.
  const dansLeBundle = bundle().some((js) => js.includes(`https://${hote}`));
  if (!dansLeBundle)
    return {
      ok: false,
      message:
        `l'HTML annonce le backend ${hote}, mais aucun fragment JavaScript de ` +
        'out/ ne le porte. out/ est incohérent : relance `npm run build`.',
    };
  return {
    ok: true,
    demo: false,
    hote,
    message:
      `Backend embarqué : ${hote} (ce que le build porte — pas une preuve que ` +
      'le projet répond).',
  };
}

// ---------------------------------------------------------------------------
// F08 — la clé du serveur SFTP
// ---------------------------------------------------------------------------

/** L'empreinte d'une clé d'hôte, au format d'OpenSSH : `SHA256:<base64 sans =>`. */
export function empreinteCleHote(cle) {
  return (
    'SHA256:' +
    createHash('sha256').update(cle).digest('base64').replace(/=+$/, '')
  );
}

/**
 * Les empreintes acceptées, lues de la configuration. Plusieurs valeurs séparées
 * par des virgules : un serveur présente une clé par algorithme, et une rotation
 * se prépare en acceptant l'ancienne et la nouvelle le temps de la bascule.
 *
 * Jette si la configuration est absente ou mal formée : sans empreinte, on ne
 * se connecte pas. Il n'y a pas de « première fois » où l'on accepterait la clé
 * présentée — c'est précisément le moment où un intermédiaire présente la sienne.
 */
export function lireEmpreintesAttendues(brut) {
  const valeurs = String(brut ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (valeurs.length === 0)
    throw new Error(
      'SFTP_HOST_FINGERPRINT est obligatoire : sans l’empreinte de la clé du ' +
        'serveur, rien ne distingue l’hébergeur d’un intermédiaire qui ' +
        'recevrait le mot de passe à sa place. Voir « Clé du serveur SFTP » ' +
        'dans le README.',
    );
  for (const v of valeurs)
    if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(v))
      throw new Error(
        `SFTP_HOST_FINGERPRINT mal formée : ${JSON.stringify(v)}. Attendu ` +
          '« SHA256: » suivi de 43 caractères (sortie de `ssh-keygen -lf`).',
      );
  return valeurs;
}

/**
 * Le vérificateur à passer à ssh2 (`hostVerifier`). Il est appelé pendant
 * l'échange de clés, donc **avant** toute authentification : une clé refusée
 * ferme la connexion sans que le mot de passe soit parti.
 *
 * `vue` garde l'empreinte présentée, pour que l'erreur puisse la dire : c'est
 * elle qu'il faut comparer à une source sûre avant de changer la configuration.
 */
export function verificateurCleHote(attendues) {
  const etat = { vue: null };
  const verifier = (cle) => {
    etat.vue = empreinteCleHote(cle);
    return attendues.includes(etat.vue);
  };
  return { verifier, etat };
}

// ---------------------------------------------------------------------------
// F16 — les fragments de la génération précédente
// ---------------------------------------------------------------------------

/**
 * Décide ce qui, de la génération qu'on remplace, doit rester servi.
 *
 * Un onglet ouvert avant la publication garde l'ancien JavaScript, et ira
 * chercher plus tard des fragments chargés à la demande (le moteur PDF, l'onglet
 * Déclaration, un fond archivé) sous leur ancien nom. Si la publication les a
 * retirés, c'est un 404 : l'export échoue, l'onglet ne s'ouvre pas, au milieu
 * du travail de la personne.
 *
 * Les fragments de `_next/static/` portent une empreinte dans leur nom : garder
 * ceux d'hier à côté de ceux d'aujourd'hui ne crée aucune collision. On les
 * garde donc `jours` jours à compter du moment où ils ont cessé d'être
 * courants — pas de leur date d'envoi, sinon une génération restée longtemps en
 * ligne disparaîtrait à la seconde où on la remplace.
 *
 * @param anciens   chemins (relatifs à `_next/static`) de la génération remplacée
 * @param nouveaux  chemins de la génération qu'on publie
 * @param manifeste `{ chemin: date ISO }` — depuis quand chaque fragment reporté
 *                  n'est plus courant
 */
export function planifierRetention({
  anciens,
  nouveaux,
  manifeste = {},
  maintenant = new Date(),
  jours = 30,
}) {
  const courants = new Set(nouveaux);
  const limite = maintenant.getTime() - jours * 24 * 60 * 60 * 1000;
  const aReporter = [];
  const suite = {};
  for (const chemin of anciens) {
    // Republié à l'identique : il fait partie de la nouvelle génération.
    if (courants.has(chemin)) continue;
    const depuis = manifeste[chemin] ?? maintenant.toISOString();
    const quand = Date.parse(depuis);
    // Une date illisible ne prolonge rien : on repart de maintenant.
    const retenu = Number.isFinite(quand) ? depuis : maintenant.toISOString();
    if (Number.isFinite(quand) && quand < limite) continue;
    aReporter.push(chemin);
    suite[chemin] = retenu;
  }
  return { aReporter, manifeste: suite };
}

// ---------------------------------------------------------------------------
// La publication par SFTP
// ---------------------------------------------------------------------------

const absent = (err) => /No such (file|directory)|not exist|ENOENT/i.test(String(err));

/**
 * Publie `out` sous `cible` : envoi à côté du site en ligne, contrôle, bascule
 * par renommages, report des fragments de la génération précédente, puis
 * suppression de celle-ci.
 *
 * `sftp` est un client déjà connecté qui parle comme `ssh2-sftp-client`
 * (`exists`, `list`, `delete`, `rmdir`, `mkdir`, `uploadDir`, `rename`, `get`,
 * `put`). C'est ce qui permet d'éprouver la manœuvre contre un double.
 */
export async function publierParSftp({
  sftp,
  out,
  cible,
  retentionJours = 30,
  maintenant = new Date(),
  journal = console,
}) {
  // Répertoires frères, dans le même compte : la bascule est un renommage, donc
  // instantané pour Apache. Le nom porte l'intention pour qui les découvrirait.
  const transit = `${cible}.transit`;
  const precedent = `${cible}.precedent`;
  // Hors du site servi : la mémoire de ce qui a été reporté, et depuis quand.
  const registre = `${cible}.fragments.json`;

  /** Vide un répertoire, sans jamais sortir de la racine qu'on lui donne. */
  async function purger(dir, racine) {
    if (dir !== racine && !dir.startsWith(racine + '/')) {
      throw new Error(`Purge hors cible refusée : ${dir}`);
    }
    for (const e of await sftp.list(dir)) {
      const p = `${dir}/${e.name}`;
      // Un lien symbolique se supprime, il ne se descend pas : y recurser
      // sortirait de la cible sans que le contrôle lexical du chemin le voie.
      if (e.type === 'l') {
        await sftp.delete(p).catch(() => {});
        continue;
      }
      if (e.type === 'd') {
        await purger(p, racine);
        await sftp.rmdir(p).catch((err) => {
          if (!absent(err)) throw err;
        });
      } else {
        // Le serveur liste parfois ce qu'il vient de perdre : une entrée déjà
        // disparue n'interrompt pas la purge (19/08 : les pages /en ont disparu
        // en ligne parce qu'un rmdir sur un répertoire absent a tout arrêté).
        await sftp.delete(p).catch((err) => {
          if (!absent(err)) throw err;
        });
      }
    }
  }

  async function supprimer(dir) {
    if (!(await sftp.exists(dir))) return;
    await purger(dir, dir);
    await sftp.rmdir(dir).catch((err) => {
      if (!absent(err)) throw err;
    });
  }

  /** Les fichiers d'un répertoire distant, en chemins relatifs. Liens ignorés. */
  async function listerDistant(dir, sous = '') {
    const ici = sous ? `${dir}/${sous}` : dir;
    const fichiers = [];
    for (const e of await sftp.list(ici)) {
      const relatif = sous ? `${sous}/${e.name}` : e.name;
      if (e.type === 'd') fichiers.push(...(await listerDistant(dir, relatif)));
      else if (e.type !== 'l') fichiers.push(relatif);
    }
    return fichiers;
  }

  /**
   * Le transit est-il un site complet ? On ne bascule pas sur un envoi partiel :
   * c'est tout l'intérêt de la manœuvre.
   */
  async function controler(dir) {
    const manquants = [];
    for (const attendu of ['index.html', '.htaccess', '_next']) {
      if (!(await sftp.exists(`${dir}/${attendu}`))) manquants.push(attendu);
    }
    // Les fragments que la page d'accueil réclame doivent être là : un envoi
    // interrompu au milieu de _next/ passerait sinon pour complet.
    const pages = readdirSync(out).filter((f) => f.endsWith('.html'));
    const references = new Set();
    for (const f of pages)
      for (const m of readFileSync(join(out, f), 'utf8').matchAll(
        /\/(_next\/static\/[A-Za-z0-9._\/-]+?\.(?:js|css))/g,
      ))
        references.add(m[1]);
    const echantillon = [...references].slice(0, 12);
    for (const ref of echantillon) {
      if (!(await sftp.exists(`${dir}/${ref}`))) manquants.push(ref);
    }
    if (manquants.length) {
      throw new Error(
        `Envoi incomplet dans ${dir} : ${manquants.slice(0, 5).join(', ')}` +
          (manquants.length > 5 ? ` (+${manquants.length - 5})` : '') +
          '. La version en ligne n’a pas été touchée.',
      );
    }
    return { pages: pages.length, fragments: echantillon.length };
  }

  /**
   * Fait passer dans la nouvelle génération les fragments de l'ancienne que des
   * onglets déjà ouverts peuvent encore demander. Par renommage : rien n'est
   * renvoyé, le serveur déplace.
   */
  async function reporterFragments() {
    const racine = '_next/static';
    if (!(await sftp.exists(`${precedent}/${racine}`))) return 0;
    let manifeste = {};
    if (await sftp.exists(registre)) {
      try {
        manifeste = JSON.parse(String(await sftp.get(registre)));
      } catch {
        // Registre illisible : les fragments repartent pour une durée entière.
        manifeste = {};
      }
    }
    const plan = planifierRetention({
      anciens: await listerDistant(`${precedent}/${racine}`),
      nouveaux: listerFichiers(join(out, '_next', 'static')),
      manifeste,
      maintenant,
      jours: retentionJours,
    });
    const dossiers = new Set();
    for (const chemin of plan.aReporter) {
      const dossier = chemin.includes('/')
        ? chemin.slice(0, chemin.lastIndexOf('/'))
        : '';
      if (dossier && !dossiers.has(dossier)) {
        await sftp.mkdir(`${cible}/${racine}/${dossier}`, true);
        dossiers.add(dossier);
      }
      await sftp.rename(
        `${precedent}/${racine}/${chemin}`,
        `${cible}/${racine}/${chemin}`,
      );
    }
    await sftp.put(
      Buffer.from(`${JSON.stringify(plan.manifeste, null, 2)}\n`),
      registre,
    );
    return plan.aReporter.length;
  }

  // 1. Envoi complet à côté du site en ligne, qui continue de servir.
  await supprimer(transit);
  await sftp.mkdir(transit, true);
  journal.log(`Envoi de out/ vers ${transit} (le site en ligne continue) …`);
  await sftp.uploadDir(out, transit);

  // 2. Contrôle avant de toucher à quoi que ce soit.
  const vu = await controler(transit);
  journal.log(
    `Envoi complet : ${vu.pages} pages, ${vu.fragments} fragments vérifiés.`,
  );

  // 3. Bascule par renommages. Entre les deux, le site est absent le temps
  //    d'un appel — sans commune mesure avec une purge suivie d'un envoi.
  await supprimer(precedent);
  const avaitUneVersion = await sftp.exists(cible);
  if (avaitUneVersion) await sftp.rename(cible, precedent);
  try {
    await sftp.rename(transit, cible);
  } catch (err) {
    // Le pire moment : la cible est partie et le transit n'a pas pris sa
    // place. On remet la version précédente avant de rendre la main.
    if (avaitUneVersion) await sftp.rename(precedent, cible).catch(() => {});
    throw err;
  }

  // 4. Contrôle après bascule, puis seulement, on jette l'ancienne version.
  if (!(await sftp.exists(`${cible}/index.html`))) {
    throw new Error(
      `Bascule douteuse : ${cible}/index.html est absent. La version ` +
        `précédente est conservée dans ${precedent}.`,
    );
  }

  // 5. Les fragments que des onglets déjà ouverts peuvent encore demander
  //    passent dans la nouvelle génération. La bascule est faite : un échec ici
  //    ne la défait pas, il se dit — les onglets anciens devront recharger.
  let reportes = 0;
  try {
    reportes = await reporterFragments();
    journal.log(
      `${reportes} fragment(s) de la génération précédente conservé(s) ` +
        `${retentionJours} jours pour les onglets déjà ouverts.`,
    );
  } catch (err) {
    journal.warn(
      `Attention : les fragments de la génération précédente n'ont pas pu ` +
        `être conservés (${err.message}). Les onglets ouverts avant cette ` +
        'publication devront être rechargés.',
    );
  }

  await supprimer(precedent);
  return { ...vu, reportes };
}
