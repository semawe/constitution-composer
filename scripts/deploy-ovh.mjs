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

// Un build fait sans les clés Supabase produit un site qui *paraît* marcher :
// compte simulé, sauvegardes dans le navigateur, rien qui suive le compte. On
// vérifie donc dans les fichiers à envoyer que la configuration est bien là,
// plutôt que de faire confiance à l'environnement du build.
{
  const chunks = join(OUT, '_next', 'static', 'chunks');
  const found = existsSync(chunks)
    && readdirSync(chunks, { recursive: true })
      .filter((f) => String(f).endsWith('.js'))
      .some((f) => readFileSync(join(chunks, String(f)), 'utf8').includes('.supabase.co'));
  if (!found && process.env.ALLOW_DEMO_DEPLOY !== 'yes') {
    console.error(
      'Erreur : le build de out/ ne porte aucune configuration Supabase — ' +
        'compte simulé et sauvegardes locales. Rebuild avec ' +
        'NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, ou assume ' +
        'la démonstration avec ALLOW_DEMO_DEPLOY=yes.',
    );
    process.exit(1);
  }
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

  const CIBLE = config.remoteDir;
  // Répertoires frères, dans le même compte : la bascule est un renommage, donc
  // instantané pour Apache. Le nom porte l'intention pour qui les découvrirait.
  const TRANSIT = `${CIBLE}.transit`;
  const PRECEDENT = `${CIBLE}.precedent`;

  const absent = (err) => /No such (file|directory)|not exist/i.test(String(err));

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
    const pages = readdirSync(OUT).filter((f) => f.endsWith('.html'));
    const references = new Set();
    for (const f of pages)
      for (const m of readFileSync(join(OUT, f), 'utf8').matchAll(
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

  try {
    await sftp.connect({
      host: config.host,
      username: config.user,
      password: config.password,
      port: Number(process.env.FTP_PORT || 22),
    });
    console.log(`Connecté à ${config.host} en SFTP.`);

    // 1. Envoi complet à côté du site en ligne, qui continue de servir.
    await supprimer(TRANSIT);
    await sftp.mkdir(TRANSIT, true);
    console.log(`Envoi de out/ vers ${TRANSIT} (le site en ligne continue) …`);
    await sftp.uploadDir(OUT, TRANSIT);

    // 2. Contrôle avant de toucher à quoi que ce soit.
    const vu = await controler(TRANSIT);
    console.log(
      `Envoi complet : ${vu.pages} pages, ${vu.fragments} fragments vérifiés.`,
    );

    // 3. Bascule par renommages. Entre les deux, le site est absent le temps
    //    d'un appel — sans commune mesure avec une purge suivie d'un envoi.
    await supprimer(PRECEDENT);
    const avaitUneVersion = await sftp.exists(CIBLE);
    if (avaitUneVersion) await sftp.rename(CIBLE, PRECEDENT);
    try {
      await sftp.rename(TRANSIT, CIBLE);
    } catch (err) {
      // Le pire moment : la cible est partie et le transit n'a pas pris sa
      // place. On remet la version précédente avant de rendre la main.
      if (avaitUneVersion) await sftp.rename(PRECEDENT, CIBLE).catch(() => {});
      throw err;
    }

    // 4. Contrôle après bascule, puis seulement, on jette l'ancienne version.
    if (!(await sftp.exists(`${CIBLE}/index.html`))) {
      throw new Error(
        `Bascule douteuse : ${CIBLE}/index.html est absent. La version ` +
          `précédente est conservée dans ${PRECEDENT}.`,
      );
    }
    await supprimer(PRECEDENT);
    console.log('Déploiement terminé (bascule atomique).');
  } catch (err) {
    console.error('Échec du déploiement :', err.message);
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
