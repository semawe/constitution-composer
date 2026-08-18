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
