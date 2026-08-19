# Constitution Composer

**Interactive Holacracy® Constitution builder** — select the articles you need, see the document compose in real time, export a ready-to-sign PDF.

🔗 **Live instance:** [constitution-composer.com](https://constitution-composer.com)

---

## What it does

Constitution Composer lets any organization adopting Holacracy build a tailored constitution without reading the full text first. You start from the mandatory core, toggle optional modules on or off, and the document assembles itself. A Principles Declaration tab lets you define your organizational values, assign signatories, and export everything as a single PDF.

Built by [Sémawé](https://semawe.fr), a French Holacracy consulting firm.

---

## Features

- **Lite model** — retractable core blocks + optional extensions
- **Principles Declaration** — drag-and-drop principles, ratifiers, signatories
- **App Store** — additional modules (governance apps, adaptations)
- **Glossary** — terms highlighted inline with tooltips
- **Auth** — Google login or magic link (Supabase)
- **PDF export** — constitution + declaration, custom logo and font
- **Dark mode** · **French / English** · **Freemium** (free core, account for extensions)
- **Admin panel** — `/admin` (accounts, versions, insertions config)

---

## Stack

- [Next.js 16](https://nextjs.org) (App Router, static export)
- TypeScript · [Tailwind v4](https://tailwindcss.com) · [Framer Motion](https://www.framer.com/motion/)
- [Supabase](https://supabase.com) (auth, storage)
- [react-pdf](https://react-pdf.org) (PDF generation)
- [Vitest](https://vitest.dev) — engine, export, markup and content-fidelity tests (see [Tests](#tests))

---

## Getting started

### Prerequisites

- Node.js ≥ 20 (recommended: install via [nvm](https://github.com/nvm-sh/nvm))
- A [Supabase](https://supabase.com) project (free tier is fine)

### Install

```bash
git clone --recurse-submodules https://github.com/semawe/constitution-composer.git
cd constitution-composer
npm install
```

The `--recurse-submodules` flag pulls in `vendor/holacracy-constitution`, the canonical
Constitution text (see [Constitution content pipeline](#constitution-content-pipeline)). It is
only needed to regenerate or verify the content files, not to build the app — if you already
cloned without it, run `git submodule update --init --recursive`.

### Environment variables

Copy `env.example` to `.env.local` and fill in your values:

```env
# Supabase (required — create your own project at supabase.com)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Analytics — Umami (optional)
NEXT_PUBLIC_UMAMI_WEBSITE_ID=
```

> **Supabase setup:** apply the migrations in `supabase/migrations/` to your project. See [Supabase docs](https://supabase.com/docs/guides/cli/local-development).

### Run

```bash
npm run dev        # http://localhost:3000
npm test           # Vitest engine tests
npm run build      # production build (static export → out/)
npm run fond:check # verify the content files match the canonical Constitution
```

---

## Constitution content pipeline

The app does not own the text it serves. The canonical Constitution lives in
[semawe/Holacracy-Constitution](https://github.com/semawe/Holacracy-Constitution) as Markdown
under `v6-alpha/`, and the JSON in `src/data/` is a machine encoding of it.

**How the source is reached: a git submodule**, pinned at `vendor/holacracy-constitution`.

Three ways were on the table — a submodule, an npm dependency, or a sibling clone expected next
to this repo. The submodule wins on the three properties that matter here:

- **Pinned and reproducible.** The commit is recorded in the tree, so a given checkout of this
  repo always regenerates the exact same content. A sibling clone would silently regenerate
  against whatever the contributor happens to have on disk — which is the very failure this
  pipeline exists to prevent.
- **Available in CI without credentials.** `semawe/Holacracy-Constitution` is public, so the
  guard below runs on any fork and any pull request. Wiring CI to a private working repo would
  have made the check unrunnable for outside contributors.
- **No packaging detour.** The Constitution is a document, not a library; publishing it to npm
  to make it importable would add a release step between editing the text and seeing it here.

Regenerating:

```bash
git submodule update --init --recursive
npm run fond:build   # rewrites src/data/principes.{fr,en}.json
```

**`src/data/principes.fr.json` and `principes.en.json` are generated. Do not edit them by hand.**
What the Markdown does not carry — the warning shown when a principle is unchecked, the legal
notice, the license — lives in `src/data/principes.overlay.{fr,en}.json` and is merged in by
identifier. A canonical principle with no matching warning (or a warning with no matching
principle) fails the generation rather than passing silently: adding a principle upstream forces
the editorial work here.

CI enforces this. The `Fond synchronisé avec la Constitution canonique` step in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm run fond:check`, which
regenerates in memory and compares against what is committed. Any divergence — a hand edit here,
or an advance in the canonical text without a regeneration — fails the build with the command to
run. Generation without that guard would protect nothing, since nobody would run it.

---

## Content releases — why a saved version keeps its text

A saved composition used to carry only its configuration: checked modules, title, values,
branding. Nothing of the text itself. So after an editorial update of `src/data/constitution.*.json`,
reopening the same "version" and exporting it produced **a different legal text under the same
name**, silently. For a document an organization adopts as its constitution, that is the worst
defect this app can produce.

Every state of the served content is therefore archived once and for all:

```bash
npm run release:new     # archives the current content as a new release
npm run release:check   # archives are intact, and the served content matches the newest one
```

- `src/data/releases/<id>/{constitution,principes}.{fr,en}.json` — the archived copies, four files
  per release. **Immutable**: the check fails if one of them changes. The Principles are archived
  too: the Declaration is the document ratifiers *sign*, so it must be re-readable exactly as it
  was signed.
- `src/data/releases/manifest.json` and `index.ts` — the registry (generated; the check fails if
  it drifts from the manifest). Imports are static because a bundle cannot resolve a computed path.
- A saved composition — and a saved Declaration — stores `{ locale, release, sha256, kind }`.
  Reopening it composes **from that release's archive**, not from today's content. The two contents
  of one release are never confused: a Constitution reference handed to the Principles resolver
  resolves to nothing rather than to the wrong document.
- Resolution is strict: an unknown release, or a digest that does not match, refuses to open and
  says so. It never silently falls back to the current content — that fallback *is* the defect.
- Compositions saved before archiving existed carry no reference. They open on the current text,
  say so, and offer to pin themselves in one click.
- The exported PDF prints the release and a short digest, so anyone can tell later which text a
  document came from.

CI enforces both invariants (`release:check`), like it does for the generated content files.

---

## Tests

`npm test` runs the Vitest suite (also run in CI, along with `fond:check`, the type check, the
lint and a full static build). What each file guards:

- **`src/lib/constitution.test.ts` — the composition engine.** `compose()`, `toggleModule()` and
  `normalizeActive()` on a synthetic fixture (default / requires / conflicts / fallback /
  conditional insertion), then the real content in **both languages**: every insertion comes out
  exactly once and inside its anchor block, the bare framework still carries every mandatory
  replacement, and checking one more module never removes a section already composed.
- **`src/lib/pdf.test.tsx` — the export.** Everything `compose()` produces must reach the PDF
  document: block headings, intent notes, insertions, mandatory replacements, organisation values,
  license and notice — with no markup leaking through (a stray `*` or a raw `- ` means the export
  failed to read a pattern) and nothing from an unchecked module left behind. The other export,
  the Principles document, is covered the same way, signature lists included. The tests walk the
  document element tree instead of rendering a PDF: fonts and a browser are not needed, and what
  is checked is the presence of the content, not the layout. A section silently missing from the
  document an organisation adopts is the worst defect this app can produce, hence the emphasis.
- **`src/lib/fond.test.ts` — fidelity to the canonical Constitution.** Article titles, intent
  notes and the terms the source defines in bold are compared against
  `vendor/holacracy-constitution`, in both directions: a retouch here or an advance upstream both
  turn it red. Requires the submodule (`git submodule update --init --recursive`) — the file says
  so rather than skipping. Also compares the FR and EN content structurally: an insertion added on
  one side only would otherwise produce an English Constitution missing a section, without
  breaking anything.
- **`src/lib/pdf.render.test.tsx` — the export, for real.** Renders actual PDFs (both documents, both languages, all five fonts) and asserts real bytes come out. The tree walk above sees what a document *contains*; it is blind to anything that breaks inside the PDF engine. This file exists because of one such defect: none of the five bundled fonts ships an italic variant, and react-pdf throws rather than synthesizing an oblique — so the Principles export, whose intro is italic, failed on every attempt in production, silently. Italic emphasis now maps to a built-in PDF italic face (`Times-Italic` / `Helvetica-Oblique`), and this test would catch the regression the moment it came back.
- **`src/lib/releases.test.ts` — immutability of a saved version.** Resolution of a content
  reference: an archived release resolves, an unknown release or a mismatched digest is refused
  with no fallback, a reference-less payload is reported as unpinned rather than silently trusted.
  The decisive case rewrites the *current* content underneath and asserts that what a pinned
  version renders does not move.
- **`src/lib/markup.test.ts` — the markup grammar.** The fond uses five patterns and no more (paragraphs, bullet lists, numbered lists, bold, italic), parsed in one place by `src/lib/markup.ts`. Beyond unit cases, a property check over every text of the real content in both languages: the grammar restitutes every word, in order — it loses nothing and invents nothing. Its two deliberate limits (no nested lists, no single-item list) are guarded on the content side rather than silently tolerated.
- **`src/components/Composer.interaction.test.tsx` and `Composer.immuabilite.test.tsx` — the
  interface, driven.** Every other file exercises the engine, the content, the grammar and the two
  exports; none of them touches a button. These two mount the Composer in jsdom and use it: opening
  a saved version, refusing one whose text is gone, pinning an old one, and — the decisive case —
  opening a version pinned to an earlier release and asserting **the sentence only that release
  contains is on screen**. The animation layer is stubbed out: outside a browser that paints, an
  AnimatePresence exit never completes and the node lingers, so a test would measure what the
  animation has not finished removing rather than what React renders. Animations themselves remain
  out of coverage, and that is stated where it matters.
- **`src/components/Principes.interaction.test.tsx` — accessibility, driven.** The principles can
  be reordered entirely from the keyboard (the HTML drag-and-drop offered no path at all), and the
  dialog behaves like a dialog: it announces its role, is named by its heading, takes focus on open,
  traps it, closes on Escape and gives focus back to whatever opened it.
- **`src/lib/i18n.test.ts` — FR/EN parity** of the UI dictionaries and of the bilingual data.

Tests are named in French and sit next to the module they cover, following the conventions of the
other Sémawé applications.

---

## Self-hosting

The app compiles to a static export (`out/`). You can host it on any static hosting (Vercel, Netlify, GitHub Pages, any Apache/Nginx server).

Required: set the environment variables above before building, as `NEXT_PUBLIC_*` values are baked into the bundle at build time.

**Note on canonical URLs:** some metadata files hard-code `constitution-composer.com` as the canonical. If you deploy a public instance under a different domain, update the canonical URLs in `src/app/**/page.tsx` before building.

The official instance ([constitution-composer.com](https://constitution-composer.com)) is deployed
to an OVH shared hosting by `scripts/deploy-ovh.mjs`. Three guards are worth reusing if you
replicate that setup:

- **SFTP by default.** Plain FTP sends the password in the clear and the account hosts other sites;
  it now requires `FTP_ALLOW_PLAINTEXT=yes` to be used at all.
- **The build must match the commit.** Twice in one day a deploy served the right code under a
  stale stamp because the build preceded the commit. The script compares `out/` to `git HEAD` and
  refuses otherwise.
- **Atomic publication.** The upload goes to a sibling `…​.transit` directory while the live site
  keeps serving, the directory is checked for completeness (`index.html`, `.htaccess`, `_next/`, and
  a sample of the chunks the pages reference), and only then is the switch made by two renames, the
  previous version kept until the new one answers. This replaced a purge-then-upload that took the
  English pages offline mid-deploy on 2026-08-19 — a failed upload now leaves the live site
  untouched.

---

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

Quick summary:
1. Open an issue to discuss the change before writing code
2. Fork the repo and create a branch from `main`
3. Make your changes — keep the existing code style (TypeScript strict, Tailwind utilities, no inline styles)
4. Run `npm test` and make sure all tests pass
5. Open a Pull Request

By contributing, you agree that your code is licensed under AGPL v3.

---

## Architecture notes

- **Constitution engine:** `src/lib/constitution.ts` — `compose()` resolves the active set of blocks; `toggleModule()` handles `requires`/`conflicts` constraints
- **Content source of truth:** the canonical Constitution, vendored as a submodule at `vendor/holacracy-constitution`. `src/data/principes.{fr,en}.json` are generated from it by `scripts/fond.mjs` and guarded in CI — see [Constitution content pipeline](#constitution-content-pipeline). `src/data/constitution.fr.json` and `constitution.en.json` are still hand-mirrored: their structured source (`composer/`) lives in the private working repo, which is deliberately not vendored here
- **Markup:** `src/lib/markup.ts` owns the grammar of the light markup the content uses; `src/components/Prose.tsx` is the only HTML renderer of it (Composer, `/lite`, `/micro`, admin viewer) and `src/lib/pdf.tsx` the only PDF one. Five copies of that grammar used to coexist and had drifted apart — the PDF ignored italics, and `/lite` printed raw asterisks on an indexed page. One grammar, two renderers: there is no longer anywhere for the drift to happen
- **PDF:** `src/lib/pdf.tsx` — uses `.woff` fonts (not `.woff2`) due to a react-pdf decoder limitation. Only weights 400 and 700 are bundled, so italic emphasis is rendered with a built-in PDF italic face rather than `fontStyle: "italic"`, which react-pdf refuses to resolve for a family with no italic variant (it throws, and the export produces nothing). Bundling the italic files of the five families would let `ITALIC_FACE` in that file go away

---

## License

- **Code** — [GNU Affero General Public License v3.0](LICENSE) (AGPL v3)
  Any modified version deployed as a network service must publish its source under the same license.
- **Constitution content** (`src/data/`, `holacracy-constitution/`) — [CC BY SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  Attribution required. Derivative works must use the same license.

"Holacracy" is a registered trademark of HolacracyOne, LLC.

---

Made with ♥ by [Sémawé](https://semawe.fr) · [constitution-composer.com](https://constitution-composer.com)
