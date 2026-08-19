# Contributing to Constitution Composer

Thank you for your interest in contributing. This document explains how to get involved.

## Before you start

Open an issue first to describe the change or feature you have in mind. This avoids duplicated effort and lets us align on direction before you write code.

## Reporting bugs

Use [GitHub Issues](https://github.com/semawe/constitution-composer/issues). Include:
- Steps to reproduce
- Expected vs actual behavior
- Browser / OS if relevant

## Development workflow

```bash
git clone https://github.com/semawe/constitution-composer.git
cd constitution-composer
npm install
cp env.example .env.local   # fill in your Supabase credentials
npm run dev
```

Create a branch from `main`:

```bash
git checkout -b feat/my-feature
```

### One trap: `git commit -a` and the submodule

The canonical Constitution is vendored as a submodule at `vendor/holacracy-constitution`. Two git
behaviours combine badly there, and they cost this repo a red `main`:

- `git reset --hard` and `git checkout` move the *pointer* recorded in the index but do not check
  out the submodule's content, so the working tree can sit on a different commit than `HEAD` records;
- the submodule then shows up as a modification, and `git commit -a` (or `git add -A`) records that
  drift as an intentional pointer change — silently, since no file appears in the diff you are
  reading.

The effect is a commit that claims to touch documentation and actually rewinds the source text.
Prefer staging paths explicitly, run `git submodule update --init` after any hard reset, and check
`git submodule status` before committing. `src/lib/fond.test.ts` catches the rewind, so run
`npm test` even on a change you believe is documentation-only.

## Code conventions

- **TypeScript strict** — no `any`, no unchecked assertions
- **Tailwind v4** — utility classes only, no inline `style={}` except for dynamic values that can't be expressed as classes
- **No new comments** unless the *why* is non-obvious
- **Tests** — engine logic goes in `src/lib/constitution.test.ts`. Run with `npm test`

## Submitting a Pull Request

1. Keep PRs focused — one concern per PR
2. All Vitest tests must pass (`npm test`)
3. Build must succeed (`npm run build`)
4. Describe what changed and why in the PR description

## Content changes

The Constitution text is not owned by this repo. It lives in
[semawe/Holacracy-Constitution](https://github.com/semawe/Holacracy-Constitution), vendored here as
the `vendor/holacracy-constitution` submodule. Everything in `src/data/` derives from it.

`src/data/principes.fr.json` and `principes.en.json` are **generated** — never edit them by hand.
Change the canonical Markdown upstream, bump the submodule, then:

```bash
npm run fond:build
```

App-side content that the canonical text does not carry (the warning shown when a principle is
unchecked, the legal notice, the license) belongs in `src/data/principes.overlay.{fr,en}.json`.

CI runs `npm run fond:check` and fails on any divergence, so a hand edit or a missed regeneration
never reaches `main`. See [Constitution content pipeline](README.md#constitution-content-pipeline).

The remaining `src/data/` files (`constitution.*.json`, `glossaire.*.json`) are still mirrored by
hand from the private working repo. Update the source first, mirror second, and do not diverge the
two.

## License

By submitting a pull request, you agree that your contribution is licensed under [AGPL v3](LICENSE). Constitution content remains under [CC BY SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Deux sondes pour les reprises visuelles

Une refonte de mise en page touche des dizaines de classes ; ni `tsc`, ni `lint`,
ni les tests ne disent si un paragraphe a disparu ou si un bord est devenu
invisible. Deux sondes le disent.

**`npm run empreinte:dom <fichier>`** — texte servi, ancres et commandes des
pages de `out/`, classes et structure volontairement ignorées. Prendre l'empreinte
avant et après, puis `diff`. Le tampon de build contenant le SHA du commit, deux
builds de commits différents diffèrent toujours d'une ligne par page : c'est le
seul écart attendu.

**`scripts/contraste-bords.js`** — à coller dans la console de la page servie :
contraste calculé de chaque bord, champs et filets comptés séparément (la
WCAG 1.4.11 ne pose son seuil de 3:1 que sur la limite d'un composant, pas sur un
filet décoratif). Trois précautions y sont documentées en tête, chacune apprise à
ses dépens :

- normaliser les couleurs par le canevas — Tailwind sert sa palette en `lab()` ;
- ne jamais basculer la classe de thème pour mesurer, mais recharger la page. Un
  sous-arbre masqué ne produit aucune image, sa transition de `border-color` reste
  figée, et `getComputedStyle` rend la couleur de l'autre thème. Ce faux positif a
  déjà fait révoquer une passe correcte ;
- cliquer les onglets montés en `ssr: false` (`Principes`, `Marketplace`) : ils
  n'existent dans aucun fichier de `out/`, et c'est par ce trou que des sites non
  convertis atteignent la production.
