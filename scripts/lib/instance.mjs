// Ce que le déploiement vers l'instance décide et fabrique, séparé de la ligne
// de commande (`scripts/deploy-instance.mjs`) pour s'éprouver sans toucher à
// l'instance : options SSH à clé d'hôte épinglée (F08), archive scellée du
// site, plan de report des fragments de la génération précédente (F16).
//
// La garde de backend (F05) est `jugerBackend()` de `./deploiement.mjs`, avec
// la seule famille « serveur ».

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listerFichiers, planifierRetention } from './deploiement.mjs';

// ---------------------------------------------------------------------------
// F08 — la clé de l'instance, épinglée
// ---------------------------------------------------------------------------

/**
 * Les clés épinglées pour `alias`, lues dans un fichier au format known_hosts.
 * Jette si le fichier n'en porte aucune : sans clé connue d'avance, il n'y a
 * pas de connexion, et jamais de « première fois » où l'on accepterait la clé
 * présentée.
 */
export function lireClesEpinglees(contenu, alias) {
  const lignes = String(contenu)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const cles = lignes
    .map((l) => l.split(/\s+/))
    .filter(([hotes, type, cle]) =>
      hotes?.split(',').includes(alias) &&
      /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))$/.test(type ?? '') &&
      /^[A-Za-z0-9+/]+=*$/.test(cle ?? ''),
    )
    .map(([, type, cle]) => ({ type, cle }));
  if (cles.length === 0)
    throw new Error(
      `aucune clé d'hôte épinglée pour « ${alias} » : sans elle, rien ne distingue ` +
        'l’instance d’un intermédiaire. Voir deploy/ssh/known_hosts.',
    );
  return cles;
}

/**
 * Les options d'OpenSSH qui épinglent la clé : ce seul fichier, sous ce seul
 * nom, et aucune acceptation d'une clé inconnue. Une clé absente du fichier
 * ferme la connexion pendant l'échange de clés, donc avant toute
 * authentification.
 */
export function optionsSsh({ knownHosts, alias, port = null }) {
  const options = [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${knownHosts}`,
    '-o', 'GlobalKnownHostsFile=/dev/null',
    '-o', `HostKeyAlias=${alias}`,
    '-o', 'UpdateHostKeys=no',
    '-o', 'ConnectTimeout=10',
  ];
  if (port) options.push('-p', String(port));
  return options;
}

/** Un mot pour un shell POSIX, entre guillemets simples. */
export function citer(mot) {
  return `'${String(mot).replace(/'/g, `'\\''`)}'`;
}

// ---------------------------------------------------------------------------
// F16 — ce qui de la génération en ligne doit rester servi
// ---------------------------------------------------------------------------

/**
 * Le plan de report, à partir de ce que l'instance sert (`anciens`, chemins
 * sous `_next/static` de la génération courante), du registre qu'elle tient,
 * et de l'export qu'on publie.
 */
export function planifierReport({ anciens, registre, out, maintenant = new Date(), jours = 30 }) {
  let manifeste = {};
  if (registre) {
    try {
      const lu = JSON.parse(registre);
      if (lu && typeof lu === 'object' && !Array.isArray(lu)) manifeste = lu;
    } catch {
      // Registre illisible : les fragments repartent pour une durée entière.
    }
  }
  const valides = anciens.filter(
    (c) => /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(c) && !/(^|\/)\.\.?(\/|$)/.test(c),
  );
  const plan = planifierRetention({
    anciens: valides,
    nouveaux: listerFichiers(join(out, '_next', 'static')),
    manifeste,
    maintenant,
    jours,
  });
  return { reporter: plan.aReporter, registre: plan.manifeste };
}

// ---------------------------------------------------------------------------
// L'archive scellée du site
// ---------------------------------------------------------------------------

const sha256 = (contenu) => createHash('sha256').update(contenu).digest('hex');

/** L'identifiant d'une release de site : `<sha du commit>-<horodatage UTC>`. */
export function identifiantRelease(commit, quand = new Date()) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`commit illisible : ${commit}`);
  const t = quand.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${commit}-${t}`;
}

/**
 * Construit l'archive que `installer-preprod.sh site` sait publier, et rend
 * son chemin et son empreinte. Le manifeste couvre chaque fichier : l'instance
 * le vérifie avant de sceller quoi que ce soit.
 */
export function construireArchiveSite({ out, releaseId, reporter, registre, sortie }) {
  const travail = mkdtempSync(join(tmpdir(), 'cc-site-'));
  try {
    // Le fichier Apache du mutualisé n'a rien à faire sur l'instance : nginx le
    // servirait comme un fichier ordinaire.
    cpSync(out, join(travail, 'site'), {
      recursive: true,
      filter: (source) => !source.endsWith('/.htaccess'),
    });
    writeFileSync(join(travail, 'RELEASE_ID'), `${releaseId}\n`);
    writeFileSync(join(travail, 'REPORTER'), reporter.length ? `${reporter.join('\n')}\n` : '');
    writeFileSync(join(travail, 'FRAGMENTS.json'), `${JSON.stringify(registre, null, 2)}\n`);
    const fichiers = listerFichiers(travail).sort();
    const manifeste = fichiers
      .map((f) => `${sha256(readFileSync(join(travail, f)))}  ./${f}`)
      .join('\n');
    writeFileSync(join(travail, 'MANIFESTE.sha256'), `${manifeste}\n`);
    mkdirSync(sortie, { recursive: true });
    const archive = join(sortie, `composer-site-${releaseId}.tar.gz`);
    // Ni attributs étendus ni fichiers AppleDouble : l'archive part de macOS vers Linux.
    execFileSync('tar', ['--no-xattrs', '-C', travail, '-czf', archive, '.'], {
      env: { ...process.env, COPYFILE_DISABLE: '1' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return { archive, empreinte: sha256(readFileSync(archive)), fichiers: fichiers.length + 1 };
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}
