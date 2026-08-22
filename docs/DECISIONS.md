# Decisions

Append-only log of documentation ambiguities resolved with the user. Never edit history; append new entries at the bottom.

## 2026-08-22

- Q: `AGENTS.md` and `CLAUDE.md` still document an `api/` serverless directory (`api/categorize.ts`, `process.env.API_KEY`, `vercel dev`). Remove or keep?
- A (user, doc-manager scope confirmation): remove — the app is a static SPA with no serverless functions.
- Source: `vercel.json` (security headers only, no `functions`/`builds`); README "no serverless functions" note (PR #78).

- Q: `CLAUDE.md` advised that API keys "go in `.env` or the in-app Settings page", but no app code reads environment variables.
- A (user, doc-manager scope confirmation): code wins — keys are entered on the in-app Settings page only.
- Source: zero `process.env` reads in app code; `stores/useSettingsStore.ts:23-30` (btoa/atob storage).

- Q: Both agent docs point to `tailwind.config.js` for theme tokens; that file does not exist.
- A (user, doc-manager scope confirmation): code wins — Tailwind v4 CSS-first config; tokens live in the `@theme` block of `src/index.css`.
- Source: `src/index.css:1-30` (`@import 'tailwindcss'`, `@source`, `@theme`); `postcss.config.js:1-4`.

- Q: `tasks.md` calls `MODERNIZATION_PLAN.md` "the active roadmap"; `AGENTS.md` calls the same file a one-off audit artifact, not a specification.
- A (user): `tasks.md` left out of scope this run and untouched; the conflict is surfaced in the change summary.
- Source: `tasks.md:3`; `AGENTS.md` "Working style" section.

- Q: README deployment required SPA fallback rewrites ("standard SPA routing"), but the app has no client-side router.
- A (doc-manager runbook pass): doc fixed — navigation is in-app state, so no rewrite rules are needed; any static host serving `index.html` works.
- Source: `App.tsx:15` (`View` state union, no router); `vercel.json` (no rewrites declared).
