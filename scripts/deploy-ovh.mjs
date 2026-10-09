// Déploiement FTP du build statique (out/) vers constitution-composer.com,
// hébergé sur le compte OVH Heterostasia (hébergement mutualisé gratuit 100 Mo).
// Même modèle que heterostasia.com. Le code reste dans ce repo (semawe/) ; le
// compte OVH n'est qu'une cible de déploiement.
//
// Aucun secret n'est stocké ici : hôte, login et mot de passe sont injectés à
// la volée par variables d'environnement au moment du déploiement.
//
//   Bash :
//     FTP_HOST='ftp.clusterXXX.hosting.ovh.net' FTP_USER='...' FTP_PASSWORD='...' npm run deploy:ovh
//   PowerShell :
//     $env:FTP_HOST='ftp.clusterXXX.hosting.ovh.net'; $env:FTP_USER='...'; $env:FTP_PASSWORD='...'; npm run deploy:ovh
//
// L'hôte et le login ne sont pas confidentiels (ils seront connus une fois
// l'hébergement gratuit provisionné sur le domaine) ; le mot de passe, lui, ne
// doit jamais toucher le disque (lien secret OVH à usage unique, mémoire seule).

import { Client } from 'basic-ftp';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  jugerBackend,
  lireEmpreintesAttendues,
  publierParSftp,
  verificateurCleHote,
} from './lib/deploiement.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'out');

// Charge .env.deploy si présent (gitignore, jamais committé)
const envDeployPath = resolve(__dirname, '..', '.env.deploy');
if (existsSync(envDeployPath)) {
  for (const line of readFileSync(envDeployPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// `sftp` (chiffré, port 22 — disponible sur cluster121) ou `ftp` (historique).
// SFTP par défaut : le FTP simple fait transiter identifiants et fichiers en
// clair, et ce compte héberge aussi www/, sosa/ et plusdedeux/ — un identifiant
// capté ouvre les trois. Vérifié le 18/08/2026 : cluster121 répond en SFTP sur
// le port 22. Le clair reste possible, mais il se demande.
const protocol = (process.env.FTP_PROTOCOL || 'sftp').toLowerCase();
if (protocol !== 'sftp' && process.env.FTP_ALLOW_PLAINTEXT !== 'yes') {
  console.error(
    'Erreur : FTP_PROTOCOL=' + protocol + ' fait transiter le mot de passe en ' +
      'clair. Utilise FTP_PROTOCOL=sftp (port 22), ou assume le clair avec ' +
      'FTP_ALLOW_PLAINTEXT=yes.',
  );
  process.exit(1);
}

const config = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  port: Number(process.env.FTP_PORT || 21),
  remoteDir: process.env.FTP_REMOTE_DIR,
  // L'offre gratuite OVH ne supporte pas le FTPS explicite (« 500 This security
  // scheme is not implemented »). FTP simple par défaut, comme pour heterostasia.
  secure: process.env.FTP_SECURE === 'true',
};

const missing = ['host', 'user', 'password'].filter((k) => !config[k]);
if (missing.length) {
  console.error(
    `Erreur : variables manquantes (${missing
      .map((k) => 'FTP_' + k.toUpperCase())
      .join(', ')}). Injecte-les à la volée, ne les stocke pas.`,
  );
  process.exit(1);
}

// Garde-fou de purge. Ce script VIDE récursivement le répertoire cible avant
// d'uploader : sur le cluster121 mutualisé, une valeur erronée (`/`, `.`, `..`,
// une faute de frappe, une variable vide) effacerait les autres sites du compte
// (www/, sosa/, plusdedeux/). FTP_REMOTE_DIR est donc obligatoire, validé, et
// jamais défaulté vers une racine.
function assertSafeRemoteDir(raw) {
  if (!raw) {
    throw new Error(
      "FTP_REMOTE_DIR est obligatoire (aucune valeur par défaut : l'ancien " +
        "défaut /www est la racine du site principal du compte).",
    );
  }
  const dir = raw.trim().replace(/\/+$/, '');
  if (!/^\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(dir)) {
    throw new Error(
      `FTP_REMOTE_DIR invalide : ${JSON.stringify(raw)}. Attendu un chemin ` +
        'absolu à au moins un segment, sans caractère exotique (ex. ' +
        '/constitution-composer).',
    );
  }
  if (dir.split('/').includes('..') || dir.split('/').includes('.')) {
    throw new Error(`FTP_REMOTE_DIR interdit (traversée de chemin) : ${raw}`);
  }
  // En FTP la session est chrootée (`/constitution-composer`) ; en SFTP le
  // chemin part du home réel (`/home/lafabriqrd/constitution-composer`). Dans
  // les deux cas, un dossier `www` final est la racine du site principal.
  if (dir.split('/').pop() === 'www' && process.env.FTP_ALLOW_WWW !== 'yes') {
    throw new Error(
      `${dir} est la racine du site principal de l’hébergement. Si c’est ` +
        'vraiment la cible, relance avec FTP_ALLOW_WWW=yes.',
    );
  }
  return dir;
}

try {
  config.remoteDir = assertSafeRemoteDir(config.remoteDir);
} catch (err) {
  console.error(`Erreur : ${err.message}`);
  process.exit(1);
}

if (!existsSync(OUT)) {
  console.error('Erreur : dossier out/ introuvable. Lance d’abord `npm run build`.');
  process.exit(1);
}

// Le build doit être celui du commit courant. Deux fois le 19/08, un déploiement
// a servi le bon code sous une étiquette périmée parce que le build précédait le
// commit — le tampon en ligne mentait, et c'est lui qui sert à savoir ce qui
// tourne. Un simple oubli d'ordre, que rien ne signalait.
{
  let tete = null;
  try {
    tete = execSync("git rev-parse --short HEAD", { cwd: resolve(__dirname, "..") })
      .toString()
      .trim();
  } catch (err) {
    // Un échec muet ici rendrait la garde décorative : on dit pourquoi elle ne
    // s'applique pas plutôt que de laisser croire qu'elle a vérifié.
    console.warn(
      `Attention : commit courant illisible (${err.message.split("\n")[0]}) — ` +
        "la correspondance entre out/ et le dépôt n'a pas été vérifiée.",
    );
  }
  if (tete) {
    const pages = readdirSync(OUT).filter((f) => f.endsWith(".html"));
    const estampille = pages.some((f) =>
      readFileSync(join(OUT, f), "utf8").includes(tete),
    );
    if (!estampille && process.env.ALLOW_STALE_BUILD !== "yes") {
      console.error(
        `Erreur : out/ ne porte pas le commit courant (${tete}). Le build est ` +
          "antérieur au dernier commit, et le tampon affiché en ligne serait faux.\n" +
          "  npm run build\n" +
          "puis relance le déploiement (ou ALLOW_STALE_BUILD=yes si c'est voulu).",
      );
      process.exit(1);
    }
  }
}

// Le commit courant doit aussi être le dernier. La garde ci-dessus vérifie que
// `out/` correspond au commit du worktree — elle ne dit rien de savoir si ce
// commit est le sommet. Les deux ensemble laissaient passer un déploiement à la
// fois frais et incomplet : le 19/08, la production est partie sur `9a51b59`
// alors que `main` était déjà trois commits plus loin, et le tampon en ligne
// affichait un commit exact mais périmé. Le tampon dit ce qui tourne, pas si
// c'est le dernier ; quand plusieurs sessions poussent le même jour, personne ne
// peut le savoir de tête.
{
  const repo = resolve(__dirname, '..');
  const git = (cmd) => execSync(cmd, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();

  // Un ref de suivi périmé donnerait une fausse assurance : on rafraîchit, et on
  // le dit si on n'a pas pu (hors ligne, dépôt sans remote).
  let remoteConnu = true;
  try {
    git('git fetch --quiet origin main');
  } catch (err) {
    remoteConnu = false;
    console.warn(
      `Attention : origin/main n'a pas pu être rafraîchi (${err.message.split('\n')[0]}) — ` +
        "la comparaison porte sur le dernier état connu localement.",
    );
  }

  let retard = null;
  let avance = null;
  try {
    retard = Number(git('git rev-list --count HEAD..origin/main'));
    avance = Number(git('git rev-list --count origin/main..HEAD'));
  } catch {
    console.warn(
      "Attention : origin/main est introuvable — impossible de vérifier que le " +
        "commit déployé est bien le dernier.",
    );
  }

  if (retard !== null && retard > 0 && process.env.DEPLOY_ALLOW_BEHIND !== 'yes') {
    const manquants = git('git log --oneline HEAD..origin/main');
    console.error(
      `Erreur : le worktree est en retard de ${retard} commit(s) sur origin/main. ` +
        "Déployer maintenant mettrait en ligne un état déjà dépassé, sous un " +
        "tampon exact mais périmé.\n\n" +
        manquants.split('\n').map((l) => '  ' + l).join('\n') +
        "\n\n  git rebase origin/main && npm run build\n" +
        "puis relance le déploiement (ou DEPLOY_ALLOW_BEHIND=yes pour revenir " +
        "délibérément à un état antérieur).",
    );
    process.exit(1);
  }

  if (avance !== null && avance > 0) {
    // Pas un blocage : déployer un travail non poussé est un cas légitime. Mais
    // il ne doit pas être silencieux — personne d'autre ne pourra reconstruire
    // ce qui est en ligne.
    console.warn(
      `Attention : ${avance} commit(s) de ce worktree ne sont pas sur origin/main. ` +
        "Ce qui part en ligne n'est reconstructible que depuis ce poste.",
    );
  }

  if (retard === 0 && avance === 0 && remoteConnu) {
    console.log('Commit courant confirmé au sommet d’origin/main.');
  }
}

// Répétition à blanc. Toutes les gardes s'exécutent, rien ne part.
//
// Ajouté après m'être fait prendre trois fois : éprouver ces gardes demandait de
// lancer le script, et le script déployait. Une garde qu'on ne peut pas essayer
// sans toucher la production ne s'essaie pas — donc ne se vérifie pas, donc ne
// protège rien de démontrable.
const aBlanc =
  process.env.DEPLOY_DRY_RUN === 'yes' || process.argv.includes('--dry-run');

// Un build fait sans les clés Supabase produit un site qui *paraît* marcher :
// compte simulé, sauvegardes dans le navigateur, rien qui suive le compte. On
// lit donc dans les fichiers à envoyer ce que le build embarque, plutôt que de
// faire confiance à l'environnement du build.
//
// La garde cherchait la sous-chaîne `.supabase.co` dans le bundle — que le SDK
// contient de lui-même. Un build de démonstration la satisfaisait (audit du
// 04/10/2026, F05). Chaque page exportée dit maintenant son backend
// (`<meta name="cc-backend">`, posée par `src/app/tete.tsx`), et c'est elle
// qu'on lit. `DEPLOY_EXPECT_BACKEND` épingle en plus l'hôte attendu.
{
  const verdict = jugerBackend(OUT, {
    autoriserDemo: process.env.ALLOW_DEMO_DEPLOY === 'yes',
    attendu: process.env.DEPLOY_EXPECT_BACKEND || '',
    // Le mutualisé ne sert que des fichiers : un build « serveur » y aurait
    // des comptes qui répondent 404. Il part sur l'instance (deploy-instance.mjs).
    familles: ['supabase'],
  });
  if (!verdict.ok) {
    console.error(`Erreur : ${verdict.message}`);
    process.exit(1);
  }
  (verdict.demo ? console.warn : console.log)(verdict.message);
}

// La clé du serveur SFTP se vérifie avant de s'y connecter, et son absence de
// la configuration est une erreur de configuration : elle se dit ici, avec les
// autres gardes, et la répétition à blanc l'éprouve aussi.
let empreintesAttendues = [];
if (protocol === 'sftp') {
  try {
    empreintesAttendues = lireEmpreintesAttendues(
      process.env.SFTP_HOST_FINGERPRINT,
    );
  } catch (err) {
    console.error(`Erreur : ${err.message}`);
    process.exit(1);
  }
}

// Placé en dernier des contrôles : la répétition ne dit « rien à envoyer »
// qu'après avoir passé le commit, la fraîcheur vis-à-vis d'origin/main et la
// présence du backend. Une répétition qui court-circuiterait les gardes
// rassurerait à tort.
if (aBlanc) {
  console.log(
    `Répétition à blanc : toutes les gardes sont passées. ${
      readdirSync(OUT).filter((f) => f.endsWith('.html')).length
    } pages prêtes pour ${config.remoteDir}. Rien n'a été envoyé.`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Transport SFTP (recommandé) — cluster121 expose SSH/SFTP sur le port 22.
// Le FTP simple fait transiter le mot de passe et le site en clair : quiconque
// observe le réseau pendant un déploiement peut récupérer les identifiants ou
// substituer les fichiers. FTP_PROTOCOL=sftp bascule sur un canal chiffré.
// ---------------------------------------------------------------------------
if (protocol === 'sftp') {
  const { default: SftpClient } = await import('ssh2-sftp-client');
  const sftp = new SftpClient();

  // ssh2 accepte toute clé de serveur quand on ne lui donne pas de quoi la
  // vérifier. Le canal était donc chiffré, mais vers n'importe qui : un
  // intermédiaire actif pouvait présenter son propre serveur et recevoir le mot
  // de passe de publication (audit du 04/10/2026, F08). Le vérificateur est
  // appelé pendant l'échange de clés, avant toute authentification.
  const cleHote = verificateurCleHote(empreintesAttendues);

  try {
    await sftp.connect({
      host: config.host,
      username: config.user,
      password: config.password,
      port: Number(process.env.FTP_PORT || 22),
      hostVerifier: cleHote.verifier,
    });
    console.log(
      `Connecté à ${config.host} en SFTP (clé du serveur vérifiée : ${cleHote.etat.vue}).`,
    );

    await publierParSftp({
      sftp,
      out: OUT,
      cible: config.remoteDir,
      retentionJours: Number(process.env.DEPLOY_FRAGMENT_RETENTION_DAYS || 30),
    });
    console.log('Déploiement terminé (bascule atomique).');
  } catch (err) {
    if (cleHote.etat.vue && !empreintesAttendues.includes(cleHote.etat.vue)) {
      console.error(
        `Échec du déploiement : la clé présentée par ${config.host} ` +
          `(${cleHote.etat.vue}) n'est pas celle attendue. Aucun identifiant ` +
          "n'a été envoyé. Ne change SFTP_HOST_FINGERPRINT qu'après avoir " +
          'vérifié cette empreinte par une source sûre : une clé qui change ' +
          'sans annonce de l’hébergeur est exactement ce que cette garde arrête.',
      );
    } else {
      console.error('Échec du déploiement :', err.message);
    }
    process.exitCode = 1;
  } finally {
    await sftp.end().catch(() => {});
  }
  process.exit(process.exitCode ?? 0);
}

const client = new Client(120000);
client.ftp.verbose = false;

// Purge récursive manuelle. Le removeDir()/clearWorkingDir() de basic-ftp ne
// vide pas les sous-répertoires sur le FTP mutualisé OVH (dossiers orphelins
// laissés en place). On recurse nous-mêmes (list parse correctement), en
// supprimant les fichiers puis les dossiers vides, de bas en haut. Indispensable
// pour ne pas laisser d'anciens répertoires homonymes de pages (ex. admin/view/)
// qui déclencheraient des redirections mod_dir parasites.
async function clearRemote(dir) {
  // Deuxième filet : aucune récursion ne peut sortir du répertoire cible, même
  // si le serveur renvoyait une entrée de listing aberrante.
  if (dir !== config.remoteDir && !dir.startsWith(config.remoteDir + '/')) {
    throw new Error(`Purge hors cible refusée : ${dir}`);
  }
  const list = await client.list(dir);
  for (const e of list) {
    if (e.name === '.' || e.name === '..') continue;
    const p = `${dir}/${e.name}`;
    if (e.isSymbolicLink) {
      // Même raison qu'en SFTP : on supprime le lien, on ne le suit pas.
      await client.remove(p).catch(() => {});
      continue;
    }
    if (e.isDirectory) {
      await clearRemote(p);
      await client.removeEmptyDir(p).catch((err) => {
        if (!String(err).includes('550')) throw err;
      });
    } else {
      // Le FTP OVH liste parfois des entrées déjà disparues : un 550 à la
      // suppression n'est pas une erreur (le fichier n'est plus là).
      await client.remove(p).catch((err) => {
        if (!String(err).includes('550')) throw err;
      });
    }
  }
}

try {
  if (!config.secure) {
    console.warn(
      'Attention : FTP en clair — identifiants et fichiers transitent sans ' +
        'chiffrement. Préfère FTP_PROTOCOL=sftp (port 22).',
    );
  }
  await client.access({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    secure: config.secure,
    // Le certificat est vérifié. FTP_INSECURE_TLS=yes ne sert qu'à diagnostiquer
    // un cluster mal configuré : un FTPS non validé n'apporte aucune garantie
    // face à un intermédiaire actif.
    secureOptions:
      process.env.FTP_INSECURE_TLS === 'yes'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  console.log(`Connecté à ${config.host} (FTPS=${config.secure}). Upload de out/ vers ${config.remoteDir} …`);
  await client.ensureDir(config.remoteDir);
  await clearRemote(config.remoteDir);
  await client.cd(config.remoteDir);
  await client.uploadFromDir(OUT);
  console.log('Déploiement terminé.');
} catch (err) {
  console.error('Échec du déploiement :', err.message);
  process.exitCode = 1;
} finally {
  client.close();
}
