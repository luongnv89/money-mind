
# MoneyMind

MoneyMind is a privacy-first, client-side financial-health report built with React. Import a bank-statement CSV and it produces a clear, deterministic analysis — savings rate, 50/30/20 split, recurring charges, a transparent health score and a prioritized action plan — calculated entirely in your browser. There is no account, no server database and no analytics.

> **Current release: v1.0.0** (2026-08-22) — see [CHANGELOG.md](CHANGELOG.md) for release history.

## Features

-   **Local-first privacy:** CSV processing happens 100% in the browser. API keys are stored in your browser's LocalStorage, obfuscated but not encrypted (`stores/useSettingsStore.ts`).
-   **Deterministic finance engine:** every figure comes from `lib/finance/` — week/month/quarter/year/all-time periods, coverage-aware baselines, standard ratios with published definitions and benchmarks, a transparent health score, rule-based insights with the money at stake, and recurring-charge detection.
-   **Overview page:** a shared period navigator, KPI cards, the health score and 50/30/20 check, key ratios, a prioritized "what to focus on" list, cash-flow chart, spending breakdown, recurring commitments and a full methodology disclosure.
-   **Transactions page:** the same period navigator plus search, category quick filters, review/verify/delete actions, CSV export and all categorization controls.
-   **Categorization pipeline:** learned rules apply first, then TypeSafe Jev when a key is set, then your configured language model, and — in demo mode only — a deterministic simulation. Identical transactions are sent once; language-model output is validated against the category hierarchy (`services/categorizationPlan.ts`, `services/normalizeCategorization.ts`).
-   **Assistant:** a professional chat that answers only from the figures the engine computed for the selected period (`services/aiService.ts`).
-   **Multi-model support:** model lists load live from each provider (1h cache, curated fallback when unreachable — `services/modelCatalog.ts`).
    -   **Cloud:** Google Gemini, Groq.
    -   **Local:** Ollama (private, no cost).
    -   **Custom:** any OpenAI-compatible endpoint.
-   **Smart learning:** "Verify" transactions to teach the app your specific preferences (stored locally, exportable from Settings).
-   **Deterministic demo data:** a fixed-seed fictional household spanning three full months plus the current month to date (`lib/demoData.ts`).

## 🛠 Tech Stack

-   **Frontend:** React 19, TypeScript, Vite (`package.json`)
-   **State Management:** Zustand (with LocalStorage persistence; `stores/useTransactionStore.ts`)
-   **Styling:** Tailwind CSS v4 via a local PostCSS build (`@tailwindcss/postcss`, no CDN; `postcss.config.js`, `src/index.css`), self-hosted Fraunces + Geist via `@fontsource-variable` (`index.tsx`), Lucide React (icons)
-   **AI Integration:** Google GenAI SDK, custom REST connectors for Groq/Ollama/custom endpoints (`services/aiService.ts`), TypeSafe Jev (`services/typesafeService.ts`)
-   **Parsing:** PapaParse (CSV) (`lib/csvParser.ts`)
-   **Visualization:** Recharts — loaded only by the lazily imported Overview page

## ⚙️ Setup & Installation

### Prerequisites
-   **Node.js 24+ (LTS)** (`.nvmrc`, `package.json`)
-   **NPM** (or Yarn/PNPM)
-   (Optional) **Ollama** for local AI: [ollama.com](https://ollama.com)

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/luongnv89/money-mind.git
    cd money-mind
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure your AI keys in the app:**
    MoneyMind does not read API keys from environment variables or `.env` files. Start the app (step 4), open the **Settings** page, and enter your TypeSafe, Gemini, Groq, Ollama or custom-endpoint details there. Keys are stored locally in your browser's LocalStorage (obfuscated, not encrypted).

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This starts the app at `http://localhost:3000` (`vite.config.ts`).

    **Note:** There are no serverless functions — `vercel.json` ships security headers plus one rewrite (`/typesafe-api/:path*` → `https://api.typesafe.ai/:path*`, which `vite.config.ts` proxies locally). No `vercel dev` step is needed for local development; the Vite dev server is all you need.

### Deployment

> Validate this runbook: `./scripts/validate-dev-setup.sh --check`

#### 1. Static Site Deployment (SPA)
MoneyMind is a Single Page Application (SPA) with no client-side router — navigation is in-app state (`App.tsx`), so there are no deep links. The only rewrite rule the app ships is `/typesafe-api/:path*` → `https://api.typesafe.ai/:path*`, which proxies TypeSafe categorization requests (TypeSafe's API does not accept direct browser calls). You can deploy it to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.):

1.  **Build the project:**
    ```bash
    npm run build
    ```
2.  **Deploy the `dist/` folder.**
    Any host that serves `dist/index.html` at the root works; no SPA fallback rewrite is required. To keep TypeSafe categorization working on a non-Vercel host, configure an equivalent `/typesafe-api/:path*` → `https://api.typesafe.ai/:path*` rewrite — without it TypeSafe is unavailable (the Gemini, Groq, Ollama and custom-endpoint modes are unaffected).

#### 2. Vercel Deployment (Static)

Since MoneyMind is a pure Single Page Application (SPA) with no serverless functions, you can deploy it to Vercel (or any static host) as a static site:

1.  Push your code to a GitHub repository.
2.  Connect the repository to **Vercel**.
3.  Vercel will automatically detect the `vite.config.ts` and build the static SPA.
4.  Open the deployed app, go to the **Settings** page, and enter your Gemini, Groq, or TypeSafe API key. Keys are stored locally in each user's browser (obfuscated, not encrypted) — no server-side key configuration is needed.

**Note:** There are no serverless functions. The app calls the Gemini, Groq, Ollama and custom-endpoint APIs directly from the browser; TypeSafe requests go through the same-origin `/typesafe-api` pass-through (`vercel.json` rewrite on Vercel, dev-server proxy locally), because TypeSafe's API rejects browser CORS. All API keys are stored locally in the browser's LocalStorage (obfuscated, not encrypted).

## 🤖 AI Configuration

MoneyMind uses AI for two jobs only — categorizing transactions and answering Assistant questions. Every metric, ratio and score is computed locally by the deterministic engine in `lib/finance/`; the Assistant answers only from those figures.

**Categorization order** (`services/aiService.ts` → `categorizeWithAI`):

1.  **Your learned rules** — categories you corrected or verified apply first (`lib/localStorage.ts`).
2.  **TypeSafe Jev** — whenever a TypeSafe API key is set in **Settings**, categorization uses TypeSafe's Jev model (`services/typesafeService.ts`): it picks each category from the app's fixed hierarchy and returns calibrated probabilities rather than generated JSON. Requests are relayed through the app's `/typesafe-api` pass-through (see Deployment).
3.  **Your language model** — one of the four modes below. Identical transactions are sent once, and the model's output is validated against the category hierarchy before it is applied.
4.  **Demo simulation** — a deterministic, offline simulation used only in demo mode when no service is configured.

The **Settings** page explains what each key and model is for, shows which categorizer is active, and hosts the display-currency preference and the delete-data danger zone.

The four language-model modes, configurable in **Settings** (`services/aiService.ts` dispatches to each; the model pickers load each provider's current model list dynamically via `services/modelCatalog.ts`, falling back to a curated list when the provider is unreachable):

1.  **Cloud (Gemini):** Google's Gemini models. Requires a free API key from [Google AI Studio](https://aistudio.google.com/).
2.  **Cloud (Groq):** Groq's ultra-fast inference. Requires an API key from [Groq Console](https://console.groq.com/).
3.  **Local (Ollama):** 100% private. Requires Ollama running locally (`ollama serve`) and a model pulled (`ollama pull llama3.2`).
4.  **Custom Endpoint:** any OpenAI-compatible server (LM Studio, vLLM, OpenRouter, local proxies). Enter the server's base URL, an API key, and a model name in Settings; requests are sent in the OpenAI chat-completions format. The model picker loads `{base URL}/models` when reachable and always accepts free-text model names.

## 🧪 Quality Assurance

We enforce a strict "Shift-Left" quality strategy.

### Manual Commands
All commands map to scripts in `package.json`:
-   `npm run dev`: Start the Vite dev server.
-   `npm run build`: Type-check and build the production bundle.
-   `npm run preview`: Preview the production build.
-   `npm run lint`: Run ESLint.
-   `npm run typecheck`: Run the TypeScript compiler.
-   `npm run format`: Fix formatting issues.
-   `npm run format:check`: Verify formatting without modifying files.
-   `npm test` / `npm run test:run`: Run the Vitest suite once.
-   `npm run test:watch`: Run Vitest in watch mode.
-   `npm run coverage`: Run the Vitest suite with a line/branch coverage report (`lib/` and `services/`, gated — see `vite.config.ts`).

### CI/CD (GitHub Actions)
On every push or pull request (`.github/workflows/ci.yml`; behaviors additionally pinned by `ci-workflow.test.ts`):
1.  **Quality Job:** Runs Lint, Format Check, Type Check, the full test suite (`npm test`), and a production build.
2.  **Security Job:** Runs **Gitleaks** (secret detection), **`npm audit --audit-level=high`** (dependency advisories), and **Trivy** (vulnerability scanning, pinned to a release tag).

## ⚠️ Security Note
This application deals with financial data.
1.  **Do not commit API Keys.** Enter them on the in-app Settings page; they are stored locally in your browser (obfuscated, not encrypted).
2.  The app is designed to be client-side only. There is no database. Clearing your browser cache will delete your transaction history and learned patterns (all state persists via `localStorage`).

## 🤝 Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow (setup, quality gates, and commit/PR conventions). In short:

1.  Fork the repo.
2.  Create a feature branch.
3.  Commit your changes.
4.  Open a Pull Request.

## 📄 License
MIT — see [LICENSE](LICENSE).
