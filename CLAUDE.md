# MoneyMind — Agent Instructions

Client-side React 19 + TypeScript + Vite app that turns bank CSVs into a private financial-health report. A deterministic engine in `lib/finance/` computes every figure. AI is used for two jobs only: TypeSafe Jev categorizes transactions (typed judgments, not generated text), and language models (Gemini, Groq, Ollama, custom endpoints) are the categorization fallback and write the Assistant's answers. No backend, no database.

## Commands

- `npm run dev` — Vite dev server on **port 3000**
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint at `--max-warnings 0`
- `npm test` — Vitest single run (`npm run test:watch` to iterate)
- `npm run format` / `npm run format:check` — Prettier
- `npm run build` — `tsc && vite build`

## Quality gates

Gates run locally via `pre-commit`; config is `.pre-commit-config.yaml`.

- **commit stage** (~5s): prettier, gitleaks, eslint, tsc, vitest
- **push stage** (~4s): production build
- After a fresh clone: `pre-commit install` — the config sets both hook types.
- The local hooks are the real gate, not `.github/workflows/ci.yml`. **Do not edit that workflow unless asked.**

## Architecture

- `App.tsx` — **no router.** Navigation is a `View` union (`'overview' | 'transactions' | 'upload' | 'settings' | 'privacy'`) + `useState`. A new page means editing `App.tsx` *and* `components/Layout.tsx`. The Overview page is lazy-loaded — it's the only Recharts consumer, keep it that way.
- `stores/` — Zustand with `persist` middleware (settings, transactions, toasts); `stores/useViewStore.ts` is deliberately *not* persisted and holds the shared period selection (`granularity` + `anchor`).
- `lib/finance/` — the deterministic finance engine and **the single source of every figure the UI shows**. Never compute financial figures in components; if the engine doesn't expose a value, add an engine function + test instead. Do not edit it unless the task is explicitly engine work.
- `services/` — `aiService` (categorization + Assistant dispatch for Gemini/Groq/Ollama/custom), `typesafeService` (TypeSafe Jev categorization, used whenever a TypeSafe key is set), `modelCatalog` (live provider model lists), `categorizationPlan` + `normalizeCategorization` (LLM output validation).
- `lib/` — `csvParser` (PapaParse), `localStorage` (learned category patterns), `utils` (`cn`, `formatCurrency`), `useFinance` hooks, deterministic `demoData`.
- There is no `api/` directory — the app is a static SPA. `vercel.json` sets security headers plus one rewrite, `/typesafe-api/:path*` → `https://api.typesafe.ai/:path*`, because TypeSafe's API rejects browser CORS; `vite.config.ts` proxies the same path for `npm run dev`/`preview`. Do not reintroduce serverless functions.
- `constants.ts` — shared app constants imported by the frontend as `../constants` (`components/`, `lib/csvParser.ts`, `services/aiService.ts`). Keep it at repo root.
- Tests are `*.test.{ts,tsx}` beside their source (a few live in `tests/`); `tests/setup.ts` is the Vitest setup file.

## Hard rules

- **Dependencies live only in `package.json`.** The old esm.sh `importmap` in `index.html` was deleted (issue #32); do not reintroduce it.
- **Tailwind v4 ships from a local PostCSS build.** `postcss.config.js` wires `@tailwindcss/postcss`; the config is CSS-first in `src/index.css` (`@import 'tailwindcss'`, `@theme` tokens, `@source` globs); `index.html` loads no CDN — there is no `tailwind.config.js`. Design tokens (`paper`, `surface`, `line`, `ink`, `ink-soft`, `muted`, `accent`, `brass`, `positive`, `negative`, `warning`, `info`) live in the `@theme` block of `src/index.css` — its `@source` globs must cover every source file or utilities silently drop out.
- **Fonts are self-hosted** via `@fontsource-variable/fraunces` (display) and `@fontsource-variable/geist` (body), imported in `index.tsx` — the CSP `font-src` is `'self'`, so CDN font links are forbidden.
- Demo data is **deterministic** (`lib/demoData.ts`, fixed-seed PRNG); there are **no usage caps**.
- **Categorization order:** learned rules → TypeSafe Jev → configured language model → demo simulation (demo mode only). The Assistant answers only from engine figures.
- **Lint runs with `--max-warnings 0`.** `@typescript-eslint/no-explicit-any` is warn-level, so a single `any` fails lint. Type it properly.
- **Keep Vitest aligned with the installed Vite major** (currently Vitest 4 for Vite 8; Vitest 3 does not accept Vite 8 as a peer). Never pin Vitest to a major that rejects the installed Vite — mismatched peers break module resolution and make `tsc` fail on `vite.config.ts`.
- **Do not delete `tests/setup.ts`.** Node 26 defines an inert global `localStorage` that shadows jsdom's; the setup file installs a working one, and every persistence test depends on it.
- Never commit `.env` or any API key. Keys go in the in-app Settings page — the app reads no environment variables.
- API keys in `localStorage` are `btoa`/`atob` obfuscated, **not encrypted.** Never describe them as encrypted in user-facing copy.
- No backend, no DB. All state is `localStorage`; clearing browser data destroys it. Do not introduce server-side persistence.
- Never rewrite a whole file for a small change.

## Workflow

- Prettier owns formatting — do not hand-format. `.prettierignore` deliberately skips `*.md` and `migrated_prompt_history/`.
- Prefer the smallest change that works. Ask before adding a dependency, a router, or a build-tool config file.
- Transaction categorization uses TypeSafe (Jev) via `services/typesafeService.ts` whenever a TypeSafe key is set; the LLM categorizers are the fallback. Read the live docs (https://docs.typesafe.ai/llms.txt) before changing its questions.
- `MODERNIZATION_PLAN.md`, `MODERNIZATION_REPORT.md`, and `CODE_REVIEW.md` are one-off audit artifacts — not specifications. Do not act on them unless asked.

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
