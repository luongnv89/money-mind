# AGENTS.md — MoneyMind

Instructions for any coding agent working in this repo. Self-contained by design: `CLAUDE.md` carries the same guidance for Claude Code, so **keep the two in sync when either changes.**

MoneyMind is a client-side React 19 + TypeScript + Vite app that categorizes bank CSVs with LLMs (Gemini, Groq, Ollama). There is no backend and no database.

## Setup & commands

- `npm install`
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

## Layout

- `App.tsx` — **no router.** Navigation is a `View` string union + `useState`. A new page means editing `App.tsx` *and* `components/Layout.tsx`.
- `stores/` — Zustand with `persist` middleware · `services/` — AI dispatch, scoring, alerts
- `lib/` — CSV parsing, learned-pattern localStorage, `cn` helper · `pages/`, `components/`
- There is no `api/` directory — the app is a static SPA; `vercel.json` sets security headers only. Do not reintroduce serverless functions.
- `constants.ts` — shared app constants imported by the frontend as `../constants` (`components/`, `lib/csvParser.ts`, `services/aiService.ts`). Keep it at repo root.
- Tests are `*.test.{ts,tsx}` beside their source (a few live in `tests/`); `tests/setup.ts` is the Vitest setup file.

## Hard rules

- **Dependencies live only in `package.json`.** The old esm.sh `importmap` in `index.html` was deleted (issue #32); do not reintroduce it.
- **Tailwind v4 ships from a local PostCSS build.** `postcss.config.js` wires `@tailwindcss/postcss`; the config is CSS-first in `src/index.css` (`@import 'tailwindcss'`, `@theme` tokens, `@source` globs); `index.html` loads no CDN — there is no `tailwind.config.js`. Edit custom tokens (`accent`, `accent-light`, `secondary`) in the `@theme` block of `src/index.css` — its `@source` globs must cover every source file or utilities silently drop out.
- **A single `any` fails lint** — `no-explicit-any` is warn-level and lint runs at zero warnings.
- **Keep Vitest aligned with the installed Vite major** (currently Vitest 4 for Vite 8; Vitest 3 does not accept Vite 8 as a peer). Never pin Vitest to a major that rejects the installed Vite — mismatched peers break module resolution and make `tsc` fail on `vite.config.ts`.
- **Do not delete `tests/setup.ts`.** Node 26 defines an inert global `localStorage` that shadows jsdom's; the setup file installs a working one.
- Never commit `.env` or an API key.
- Stored API keys use `btoa`/`atob` obfuscation, **not encryption.** Never call them encrypted in user-facing copy.
- All state is `localStorage`. Do not introduce server-side persistence.
- Never rewrite a whole file for a small change.

## Working style

- Prettier owns formatting — do not hand-format. `.prettierignore` deliberately skips `*.md` and `migrated_prompt_history/`.
- Ask before adding a dependency, a router, or a build-tool config file.
- `MODERNIZATION_PLAN.md`, `MODERNIZATION_REPORT.md`, and `CODE_REVIEW.md` are one-off audit artifacts, not specifications.
- Subagent definitions do **not** belong here — put them in `.claude/agents/*.md`.

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
