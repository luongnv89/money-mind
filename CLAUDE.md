# MoneyMind — Agent Instructions

Client-side React 19 + TypeScript + Vite app that categorizes bank CSVs with LLMs. No backend, no database.

## Commands

- `npm run dev` — Vite dev server on **port 3000**
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint at `--max-warnings 0`
- `npm test` — Vitest single run (`npm run test:watch` to iterate)
- `npm run format` / `npm run format:check` — Prettier
- `npm run build` — `tsc && vite build`
- `vercel dev` — only when exercising the `api/` serverless functions

## Quality gates

Gates run locally via `pre-commit` (installed with Homebrew); config is `.pre-commit-config.yaml`.

- **commit stage** (~5s): prettier, gitleaks, eslint, tsc, vitest
- **push stage** (~4s): production build
- After a fresh clone: `pre-commit install` — the config sets both hook types.
- The local hooks are the real gate, not `.github/workflows/ci.yml`. **Do not edit that workflow unless asked.**

## Architecture

- `App.tsx` — **no router.** Navigation is a `View` string union + `useState`. A new page means editing `App.tsx` *and* `components/Layout.tsx`.
- `stores/` — Zustand with `persist` middleware (settings, transactions, toasts)
- `services/` — `aiService` (Gemini/Groq/Ollama dispatch), `scoreService`, `alertService`
- `lib/` — `csvParser` (PapaParse), `localStorage` (learned category patterns), `utils` (`cn`)
- `api/` — Vercel serverless functions; server-side key lives in `process.env.API_KEY`
- `constants.ts` — imported by **both** the frontend and `api/categorize.ts` via `../constants`. Keep it at repo root or the Vercel build breaks.
- Tests are `*.test.ts` beside their source; `tests/setup.ts` is the Vitest setup file.

## Hard rules

- **YOU MUST update dependencies in two places:** `package.json` *and* the esm.sh `importmap` in `index.html`. They have already drifted. Changing only one breaks runtime resolution.
- **Tailwind ships from a local PostCSS build.** `tailwind.config.js`, `postcss.config.js`, and `src/index.css` define it; `index.html` loads no CDN. Edit custom tokens (`accent`, `accent-light`, `secondary`) in `tailwind.config.js` — its `content` globs must cover every source file or utilities silently drop out.
- **Lint runs with `--max-warnings 0`.** `@typescript-eslint/no-explicit-any` is warn-level, so a single `any` fails lint. Type it properly.
- **Keep Vitest on 3.x.** Vitest 2 refuses Vite 6 as a peer and nests its own Vite 5, which makes `tsc` fail on `vite.config.ts` with unassignable `PluginOption` types.
- **Do not delete `tests/setup.ts`.** Node 26 defines an inert global `localStorage` that shadows jsdom's; the setup file installs a working one, and every persistence test depends on it.
- Never commit `.env` or any API key. Keys go in `.env` or the in-app Settings page.
- API keys in `localStorage` are `btoa`/`atob` obfuscated, **not encrypted.** Never describe them as encrypted in user-facing copy.
- No backend, no DB. All state is `localStorage`; clearing browser data destroys it. Do not introduce server-side persistence.
- Never rewrite a whole file for a small change.

## Workflow

- Prettier owns formatting — do not hand-format. `.prettierignore` deliberately skips `*.md` and `migrated_prompt_history/`.
- Prefer the smallest change that works. Ask before adding a dependency, a router, or a build-tool config file.
- `MODERNIZATION_PLAN.md`, `MODERNIZATION_REPORT.md`, and `CODE_REVIEW.md` are one-off audit artifacts — not specifications. Do not act on them unless asked.

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
