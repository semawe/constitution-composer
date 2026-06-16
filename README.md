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
- [Vitest](https://vitest.dev) (16 engine tests)

---

## Getting started

### Prerequisites

- Node.js ≥ 20 (recommended: install via [nvm](https://github.com/nvm-sh/nvm))
- A [Supabase](https://supabase.com) project (free tier is fine)

### Install

```bash
git clone https://github.com/semawe/constitution-composer.git
cd constitution-composer
npm install
```

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
```

---

## Self-hosting

The app compiles to a static export (`out/`). You can host it on any static hosting (Vercel, Netlify, GitHub Pages, any Apache/Nginx server).

Required: set the environment variables above before building, as `NEXT_PUBLIC_*` values are baked into the bundle at build time.

**Note on canonical URLs:** some metadata files hard-code `constitution-composer.com` as the canonical. If you deploy a public instance under a different domain, update the canonical URLs in `src/app/**/page.tsx` before building.

The official instance ([constitution-composer.com](https://constitution-composer.com)) is deployed via FTP to an OVH shared hosting. See `scripts/deploy-ovh.mjs` if you want to replicate that setup.

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
- **Content source of truth:** `holacracy-constitution/composer/` (`SCHEMA.md` + `constitution.fr.json`). `src/data/constitution.fr.json` is a copy — do not edit it directly
- **PDF:** `src/lib/pdf.tsx` — uses `.woff` fonts (not `.woff2`) due to a react-pdf decoder limitation

---

## License

- **Code** — [GNU Affero General Public License v3.0](LICENSE) (AGPL v3)
  Any modified version deployed as a network service must publish its source under the same license.
- **Constitution content** (`src/data/`, `holacracy-constitution/`) — [CC BY SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  Attribution required. Derivative works must use the same license.

"Holacracy" is a registered trademark of HolacracyOne, LLC.

---

Made with ♥ by [Sémawé](https://semawe.fr) · [constitution-composer.com](https://constitution-composer.com)
