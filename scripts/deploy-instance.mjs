// Déploiement du site (export statique) vers l'instance Sémawé, et au besoin du
// service des comptes : tâche ERP 3052 (lot 4), préproduction d'abord.
//
// Tout se construit sur le poste, rien ne se compile sur l'instance :
//   1. gardes : out/ porte le backend « serveur » (F05) et le commit courant,
//      l'arbre est propre, le commit n'est pas en retard sur origin/main ;
//   2. lecture, sans droit particulier, de ce que l'instance sert : registre des
//      fragments reportés et fichiers de la génération courante ;
//   3. archive scellée du site (manifeste SHA-256) avec le plan de report des
//      fragments (F16), et archive du dossier deploy/ du même commit ;
//   4. dépôt par SSH, clé d'hôte épinglée (deploy/ssh/known_hosts, F08) ;
//   5. en root, sur l'instance : dossier d'exploitation du commit, puis
//      `installer-preprod.sh site` (vérification, scellement, report des
//      fragments, bascule atomique du lien /srv/composer/site) ;
//   6. contrôle : la page servie porte la marque et le commit, la santé répond.
//
// Usage :
//   NEXT_PUBLIC_BACKEND=serveur npm run build
//   npm run deploy:instance                  # site seul
//   npm run deploy:instance -- --avec-serveur  # site et service des comptes
//   npm run deploy:instance -- --dry-run       # gardes et archives, rien ne part
//
// Variables (toutes facultatives) : DEPLOY_SSH_DESTINATION (vps-semawe),
// DEPLOY_SSH_ALIAS (semawe-prod-gra11), DEPLOY_SSH_KNOWN_HOSTS
// (deploy/ssh/known_hosts), DEPLOY_URL (https://preprod.constitution-composer.com),
// DEPLOY_SORTIE (~/.cache/composer-artefacts), DEPLOY_ALLOW_BEHIND=yes.
//
// Le mot de passe sudo du compte de service se lit comme le fait `vps-sudo` :
// dans le trousseau macOS (vps-semawe-sudo / debian), passé à sudo par l'entrée
// standard, jamais affiché ni écrit.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jugerBackend, lireMarqueBackend } from './lib/deploiement.mjs';
import {
  citer,
  construireArchiveSite,
  identifiantRelease,
  lireClesEpinglees,
  optionsSsh,
  planifierReport,
} from './lib/instance.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(RACINE, 'out');
const aBlanc = process.argv.includes('--dry-run') || process.env.DEPLOY_DRY_RUN === 'yes';
const avecServeur = process.argv.includes('--avec-serveur');

const DESTINATION = process.env.DEPLOY_SSH_DESTINATION || 'vps-semawe';
const ALIAS = process.env.DEPLOY_SSH_ALIAS || 'semawe-prod-gra11';
const KNOWN_HOSTS = resolve(RACINE, process.env.DEPLOY_SSH_KNOWN_HOSTS || 'deploy/ssh/known_hosts');
const URL_CIBLE = (process.env.DEPLOY_URL || 'https://preprod.constitution-composer.com').replace(/\/+$/, '');
const SORTIE = process.env.DEPLOY_SORTIE || join(homedir(), '.cache', 'composer-artefacts');
const SRV = '/srv/composer';

function arreter(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const git = (...args) =>
  execFileSync('git', args, { cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

// ---------------------------------------------------------------------------
// 1. Gardes
// ---------------------------------------------------------------------------

if (!existsSync(OUT)) arreter('dossier out/ introuvable. Lance d’abord `NEXT_PUBLIC_BACKEND=serveur npm run build`.');

{
  const verdict = jugerBackend(OUT, { familles: ['serveur'] });
  if (!verdict.ok) arreter(verdict.message);
  console.log(verdict.message);
}

const COMMIT = git('rev-parse', 'HEAD');
{
  const court = COMMIT.slice(0, 7);
  const pages = readdirSync(OUT).filter((f) => f.endsWith('.html'));
  if (!pages.some((f) => readFileSync(join(OUT, f), 'utf8').includes(court)))
    arreter(
      `out/ ne porte pas le commit courant (${court}) : le build est antérieur au dernier ` +
        'commit, et le tampon affiché en ligne serait faux. Relance le build.',
    );
  // Le dossier d'exploitation part de ce commit par `git archive` : un arbre sale
  // déploierait autre chose que ce qui est committé.
  if (git('status', '--porcelain')) arreter('l’arbre de travail n’est pas propre : committe ou range d’abord.');
  try {
    git('fetch', '--quiet', 'origin', 'main');
  } catch (err) {
    console.warn(`Attention : origin/main n'a pas pu être rafraîchi (${String(err.message).split('\n')[0]}).`);
  }
  try {
    const retard = Number(git('rev-list', '--count', 'HEAD..origin/main'));
    const avance = Number(git('rev-list', '--count', 'origin/main..HEAD'));
    if (retard > 0 && process.env.DEPLOY_ALLOW_BEHIND !== 'yes')
      arreter(
        `le commit est en retard de ${retard} commit(s) sur origin/main : la cible recevrait un ` +
          'état déjà dépassé (DEPLOY_ALLOW_BEHIND=yes pour un retour délibéré).',
      );
    if (avance > 0)
      console.warn(
        `Attention : ${avance} commit(s) ne sont pas sur origin/main (branche de travail) : ce qui ` +
          'part n’est reconstructible que depuis une branche poussée.',
      );
  } catch {
    console.warn('Attention : origin/main est introuvable, la fraîcheur du commit n’est pas vérifiée.');
  }
}

let clesEpinglees;
try {
  clesEpinglees = lireClesEpinglees(readFileSync(KNOWN_HOSTS, 'utf8'), ALIAS);
} catch (err) {
  arreter(err.message);
}
console.log(`Clé d'hôte épinglée : ${clesEpinglees.length} clé(s) pour ${ALIAS} (${KNOWN_HOSTS}).`);
const SSH = optionsSsh({ knownHosts: KNOWN_HOSTS, alias: ALIAS });

// ---------------------------------------------------------------------------
// 2. Ce que l'instance sert aujourd'hui
// ---------------------------------------------------------------------------

function ssh(commande, options = {}) {
  return execFileSync('ssh', [...SSH, '-T', DESTINATION, commande], {
    stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
    input: options.input,
  }).toString();
}

let anciens = [];
let registre = '';
if (aBlanc) {
  console.log('Répétition à blanc : l’état de l’instance n’est pas lu, aucun fragment à reporter.');
} else {
  const etat = ssh(
    `cat ${SRV}/site-fragments.json 2>/dev/null; echo; echo '--- fichiers ---'; ` +
      // Première publication : il n'y a que la page d'attente, sans _next/static.
      // L'absence n'est pas une erreur, elle veut dire « rien à reporter ».
      `if cd ${SRV}/site/_next/static 2>/dev/null; then find -L . -type f | sed 's|^\\./||'; fi`,
  );
  const [avant, apres = ''] = etat.split('--- fichiers ---');
  registre = avant.trim();
  anciens = apres.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`Génération en ligne : ${anciens.length} fichier(s) sous _next/static.`);
}

// ---------------------------------------------------------------------------
// 3. Les archives
// ---------------------------------------------------------------------------

const releaseId = identifiantRelease(COMMIT);
const plan = planifierReport({ anciens, registre, out: OUT });
const site = construireArchiveSite({
  out: OUT,
  releaseId,
  reporter: plan.reporter,
  registre: plan.registre,
  sortie: SORTIE,
});
console.log(
  `Archive du site : ${site.archive} (${site.fichiers} fichiers, sha256 ${site.empreinte}) ; ` +
    `${plan.reporter.length} fragment(s) de la génération précédente à reporter.`,
);

mkdirSync(SORTIE, { recursive: true });
const exploitation = join(SORTIE, `composer-exploitation-${COMMIT}.tar`);
writeFileSync(exploitation, execFileSync('git', ['archive', '--format=tar', COMMIT, 'deploy'], { cwd: RACINE }));
const empreinteExploitation = createHash('sha256').update(readFileSync(exploitation)).digest('hex');

let serveur = null;
if (avecServeur) {
  const chemin = execFileSync(join(RACINE, 'deploy', 'construire-artefact.sh'), ['--commit', COMMIT, '--sortie', SORTIE], {
    cwd: RACINE,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim()
    .split('\n')
    .at(-1);
  serveur = { archive: chemin, empreinte: createHash('sha256').update(readFileSync(chemin)).digest('hex') };
  console.log(`Artefact du service : ${serveur.archive} (sha256 ${serveur.empreinte}).`);
}

if (aBlanc) {
  console.log('Répétition à blanc : toutes les gardes sont passées, les archives sont prêtes, rien n’est parti.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 4. Dépôt, clé d'hôte épinglée
// ---------------------------------------------------------------------------

const envois = [site.archive, exploitation, ...(serveur ? [serveur.archive] : [])];
execFileSync('scp', [...SSH, '-q', ...envois, `${DESTINATION}:/tmp/`], { stdio: 'inherit' });
console.log(`Déposé dans /tmp de l'instance : ${envois.map((f) => basename(f)).join(', ')}.`);

// ---------------------------------------------------------------------------
// 5. En root : dossier d'exploitation du commit, publication, bascule
// ---------------------------------------------------------------------------

function motDePasseSudo() {
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'vps-semawe-sudo', '-a', 'debian', '-w'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .replace(/\n$/, '');
  } catch {
    arreter(
      'le mot de passe sudo du compte de service est absent du trousseau (entrée vps-semawe-sudo / ' +
        'debian, la même que vps-sudo).',
    );
  }
}

const D = `/opt/composer-exploitation/${COMMIT}`;
const tmp = (f) => `/tmp/${basename(f)}`;
const etapes = [
  'set -euo pipefail',
  `echo ${citer(`${empreinteExploitation}  ${tmp(exploitation)}`)} | sha256sum -c --quiet`,
  `if [ ! -d ${citer(D)} ]; then install -d -o root -g root -m 0755 ${citer(D)}; ` +
    `tar -xf ${citer(tmp(exploitation))} -C ${citer(D)} --no-same-owner --no-same-permissions; ` +
    `chown -R root:root ${citer(D)}; chmod -R go-w ${citer(D)}; fi`,
  `bash ${citer(`${D}/deploy/installer-preprod.sh`)} site ${citer(tmp(site.archive))} ${citer(site.empreinte)}`,
];
if (serveur)
  etapes.push(
    `bash ${citer(`${D}/deploy/installer-preprod.sh`)} release ${citer(tmp(serveur.archive))} ${citer(serveur.empreinte)}`,
    'systemctl start composer-migrer.service',
    'systemctl restart composer.service',
  );
etapes.push(`rm -f ${envois.map((f) => citer(tmp(f))).join(' ')}`);

const commandeRoot = etapes.join('\n');
ssh(`sudo -S -p '' /bin/bash -c ${citer(commandeRoot)}`, { input: `${motDePasseSudo()}\n` });
console.log(`Publié en ${releaseId}.`);

// ---------------------------------------------------------------------------
// 6. Contrôle
// ---------------------------------------------------------------------------

const page = await fetch(`${URL_CIBLE}/`, { cache: 'no-store' }).then((r) => r.text());
const marque = lireMarqueBackend(page);
if (marque !== 'serveur') arreter(`la page servie porte la marque « ${marque} », pas « serveur ».`);
if (!page.includes(COMMIT.slice(0, 7))) arreter(`la page servie ne porte pas le commit ${COMMIT.slice(0, 7)}.`);
// Le service vient d'être redémarré : il lui faut quelques secondes pour
// écouter. Un 502 dans cet intervalle n'est pas un échec du déploiement.
let sante;
for (let essai = 1; ; essai++) {
  sante = await fetch(`${URL_CIBLE}/api/sante`, { cache: 'no-store' }).catch(() => null);
  if ((sante && sante.ok) || essai === 10) break;
  await new Promise((r) => setTimeout(r, 1000));
}
if (!sante) arreter('/api/sante injoignable.');
console.log(
  `Contrôle : ${URL_CIBLE}/ porte « serveur » et ${COMMIT.slice(0, 7)} ; /api/sante répond ${sante.status}.`,
);
if (!sante.ok) process.exit(1);
