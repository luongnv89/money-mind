# Contributing to MoneyMind

Thanks for your interest in contributing! MoneyMind is a client-side React 19 + TypeScript + Vite app that categorizes bank CSVs with LLMs (Gemini, Groq, Ollama). There is no backend and no database — all state lives in the browser's LocalStorage.

## Prerequisites

- **Node.js 24+** (the version pinned in `.nvmrc`)
- **npm**

## Setup

```bash
git clone https://github.com/luongnv89/money-mind.git
cd money-mind
npm install
pre-commit install   # installs the commit and push hooks from .pre-commit-config.yaml
```

## Everyday commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Type-check and build the production bundle into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint at `--max-warnings 0` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `npm run format:check` | Prettier write / verify |
| `npm test` / `npm run test:run` | Vitest single run (`npm run test:watch` to iterate) |
| `npm run coverage` | Vitest with a line/branch coverage report |

## Quality gates

The local pre-commit hooks are the real gate (config: `.pre-commit-config.yaml`):

- **commit stage** (~5s): prettier, gitleaks, eslint, tsc, vitest
- **push stage** (~4s): production build

CI (`.github/workflows/ci.yml`) runs the same quality job plus a security job (Gitleaks, `npm audit --audit-level=high`, Trivy).

## Commit and PR conventions

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description (#issue)`, e.g. `fix(dashboard): correct monthly total rounding (#42)`.
- Keep PRs atomic — one logical change per PR — and reference the issue (`Closes #N`) in the PR body.
- Prettier owns formatting; do not hand-format code.

## Security rules

- **Never commit API keys or `.env` files.** The app reads AI keys from the in-app **Settings** page only; they are stored locally in the browser (obfuscated, not encrypted).
- All state is `localStorage` — do not introduce server-side persistence.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
