// Publication du miroir public (semawe/constitution-composer) depuis main
// (semawe/app-constitution-composer, privé) : tâche ERP 3040.
//
// Deux dossiers de main ne sont pas publiés :
//   - echanges/ : la boîte aux lettres entre agents (audits, constats de
//     sécurité, comptes rendus de remédiation) ;
//   - deploy/   : l'exploitation de l'instance partagée de Sémawé (vhosts et
//     exceptions du pare-feu applicatif, banc d'essai du WAF, installeur).
//     Décision d'Aliocha du 09/10/2026.
//
// Le miroir reçoit donc un instantané, pas l'historique : un commit dont
// l'arbre est celui de main moins ces dossiers, et dont le parent est la tête
// du miroir. Le commit nomme la source (`Miroir-de: <sha>`) et liste les commits
// de main qu'il couvre. Le miroir avance en avance rapide, et main n'en est plus
// un descendant : un `git push public main` direct est refusé par GitHub (non
// fast-forward) au lieu de publier la boîte aux lettres.
//
// Usage :
//   npm run miroir:publier -- --dry-run   # construit le commit, n'envoie rien
//   npm run miroir:publier                # publie
//
// Gardes : arbre propre, HEAD égal à origin/main, rien à publier si l'arbre
// filtré est celui du miroir. Variable facultative MIROIR_REMOTE (public).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const EXCLUS = ['echanges', 'deploy'];
const REMOTE = process.env.MIROIR_REMOTE || 'public';
const aBlanc = process.argv.includes('--dry-run');

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
}

function arreter(message) {
  console.error(`Refus : ${message}`);
  process.exit(1);
}

function estAncetre(a, b) {
  try {
    git(['merge-base', '--is-ancestor', a, b]);
    return true;
  } catch {
    return false;
  }
}

/** Le commit de main d'où vient la tête du miroir. */
function sourcePubliee(tete) {
  // Avant la première publication par ce script, le miroir était un ancêtre
  // de main (`git push public main`) : sa tête est sa propre source.
  if (estAncetre(tete, 'HEAD')) return tete;
  const m = /^Miroir-de: ([0-9a-f]{40})$/m.exec(git(['log', '-1', '--format=%B', tete]));
  if (!m) arreter(`la tête de ${REMOTE}/main ne dit pas de quel commit de main elle vient.`);
  return m[1];
}

if (git(['status', '--porcelain', '--untracked-files=no'])) arreter('l’arbre de travail n’est pas propre.');
git(['fetch', '--quiet', 'origin']);
git(['fetch', '--quiet', REMOTE]);
const head = git(['rev-parse', 'HEAD']);
if (head !== git(['rev-parse', 'origin/main']))
  arreter('HEAD n’est pas origin/main : on ne publie que ce que main porte déjà.');

const tete = git(['rev-parse', `${REMOTE}/main`]);
const source = sourcePubliee(tete);

// Arbre de main moins les dossiers exclus, par un index jetable : ni l'index
// ni l'arbre de travail du dépôt ne bougent.
const temp = mkdtempSync(join(tmpdir(), 'miroir-'));
let arbre;
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(temp, 'index') };
  git(['read-tree', head], { env });
  git(['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', ...EXCLUS], { env });
  arbre = git(['write-tree'], { env });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const fuites = git(['ls-tree', '--name-only', arbre]).split('\n').filter((n) => EXCLUS.includes(n));
if (fuites.length) arreter(`l’arbre filtré porte encore ${fuites.join(', ')}.`);

if (arbre === git(['rev-parse', `${tete}^{tree}`])) {
  console.log(`Rien à publier : ${REMOTE}/main porte déjà l’état de ${head.slice(0, 7)}.`);
  process.exit(0);
}

// Les sujets « [BOITE] » sont ceux de la boîte aux lettres : ils nomment ce
// qu'elle porte, même quand le commit touche aussi un fichier publié.
const couverts = git([
  'log', '--no-merges', '--format=- %h %s', `${source}..${head}`,
  '--', '.', ...EXCLUS.map((d) => `:!${d}`),
])
  .split('\n')
  .filter((l) => l && !/^- \S+ \[BOITE\]/.test(l))
  .join('\n');
const message = [
  `Publication du miroir depuis ${head.slice(0, 7)}`,
  '',
  `Instantané de main sans ${EXCLUS.map((d) => `${d}/`).join(' ni ')}.`,
  ...(couverts ? ['', 'Commits couverts :', couverts] : []),
  '',
  `Miroir-de: ${head}`,
].join('\n');

const commit = git(['commit-tree', arbre, '-p', tete, '-F', '-'], { input: message });
console.log(message);
console.log(`\nCommit du miroir : ${commit} (parent ${tete.slice(0, 7)}).`);

if (aBlanc) {
  console.log('Répétition à blanc : rien n’est parti.');
  process.exit(0);
}
git(['push', '--quiet', REMOTE, `${commit}:refs/heads/main`]);
if (git(['ls-remote', REMOTE, 'refs/heads/main']).split(/\s/)[0] !== commit)
  arreter(`${REMOTE}/main ne porte pas ${commit} après l’envoi.`);
console.log(`Publié : ${REMOTE}/main = ${commit.slice(0, 7)}.`);
