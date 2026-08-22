
# MoneyMind 🧠💰

MoneyMind is a privacy-first, serverless financial analyzer built with React. It uses local AI (Ollama) or Cloud AI (Gemini/Groq) to categorize transactions, detect spending patterns, and provide "sassy" financial advice—all without storing your data on a backend server.

## 🚀 Features

-   **Zero-Knowledge Privacy:** CSV processing happens 100% in the browser. API keys are obfuscated and stored locally in your browser's LocalStorage (not encrypted).
-   **AI Categorization:** Automatically categorizes messy bank transactions using LLMs.
-   **Multi-Model Support:**
    -   ☁️ **Cloud:** Google Gemini (Default), Groq (Fastest).
    -   🏠 **Local:** Ollama (Private, no cost).
-   **Smart Learning:** "Verify" transactions to teach the app your specific preferences (stored locally).
-   **Sassy Financial Assistant:** Chat with "MonkeySmile," a persona that roasts or toasts your spending habits.
-   **Visual Insights:** Interactive charts for monthly performance, spending mix, and financial health scoring.

## 🛠 Tech Stack

-   **Frontend:** React 19, TypeScript, Vite
-   **State Management:** Zustand (with LocalStorage persistence)
-   **Styling:** Tailwind CSS v4 via a local PostCSS build (`@tailwindcss/postcss`, no CDN), Lucide React (Icons)
-   **AI Integration:** Google GenAI SDK, Custom REST connectors for Groq/Ollama
-   **Parsing:** PapaParse (CSV)
-   **Visualization:** Recharts

## ⚙️ Setup & Installation

### Prerequisites
-   **Node.js 24+ (LTS)**
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
    MoneyMind does not read API keys from environment variables or `.env` files. Start the app (step 4), open the **Settings** page, and enter your Gemini or Groq key there. Keys are stored locally in your browser's LocalStorage (obfuscated, not encrypted).

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This starts the app at `http://localhost:3000`. Configure your AI keys on the in-app **Settings** page.

    **Note:** There are no serverless functions — the `api/` directory has been removed. No `vercel dev` step is needed for local development; the Vite dev server is all you need.

### Deployment

#### 1. Static Site Deployment (SPA)
MoneyMind is primarily a Single Page Application (SPA). You can deploy it to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.):

1.  **Build the project:**
    ```bash
    npm run build
    ```
2.  **Deploy the `dist/` folder.**
    Ensure your hosting provider is configured to redirect all requests to `index.html` (standard SPA routing).

#### 2. Vercel Deployment (Static)

Since MoneyMind is a pure Single Page Application (SPA) with no serverless functions, you can deploy it to Vercel (or any static host) as a static site:

1.  Push your code to a GitHub repository.
2.  Connect the repository to **Vercel**.
3.  Vercel will automatically detect the `vite.config.ts` and build the static SPA.
4.  Open the deployed app, go to the **Settings** page, and enter your Gemini or Groq API key. Keys are stored locally in each user's browser (obfuscated, not encrypted) — no server-side key configuration is needed.

**Note:** There are no serverless functions (`api/` directory removed). The app calls AI provider APIs (Gemini, Groq, Ollama) directly from the browser. All API keys are stored locally in the browser's LocalStorage (obfuscated, not encrypted).

## 🤖 AI Configuration

MoneyMind supports three AI modes, configurable in the **Settings** page:

1.  **Cloud (Gemini):** Uses Google's Gemini models. Requires a free API key from [Google AI Studio](https://aistudio.google.com/).
2.  **Cloud (Groq):** Uses Groq's ultra-fast inference. Requires an API key from [Groq Console](https://console.groq.com/).
3.  **Local (Ollama):** 100% private. Requires Ollama running locally (`ollama serve`) and the `llama3.2` (or similar) model pulled (`ollama pull llama3.2`).

## 🧪 Quality Assurance

We enforce a strict "Shift-Left" quality strategy.

### Manual Commands
-   `npm run dev`: Start the Vite dev server.
-   `npm run build`: Type-check and build the production bundle.
-   `npm run preview`: Preview the production build.
-   `npm run lint`: Run ESLint.
-   `npm run typecheck`: Run the TypeScript compiler.
-   `npm run format`: Fix formatting issues.
-   `npm run format:check`: Verify formatting without modifying files.
-   `npm test` / `npm run test:run`: Run the Vitest suite once.
-   `npm run test:watch`: Run Vitest in watch mode.
-   `npm run coverage`: Run the Vitest suite with a line/branch coverage report (`lib/` and `services/`).

### CI/CD (GitHub Actions)
On every push or pull request:
1.  **Quality Job:** Runs Lint, Format Check, Type Check, the full test suite (`npm test`), and a production build.
2.  **Security Job:** Runs **Gitleaks** (secret detection), **`npm audit --audit-level=high`** (dependency advisories), and **Trivy** (vulnerability scanning, pinned to a release tag).

## ⚠️ Security Note
This application deals with financial data.
1.  **Do not commit API Keys.** Enter them on the in-app Settings page; they are stored locally in your browser (obfuscated, not encrypted).
2.  The app is designed to be client-side only. There is no database. Clearing your browser cache will delete your transaction history and learned patterns.

## 🤝 Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow (setup, quality gates, and commit/PR conventions). In short:

1.  Fork the repo.
2.  Create a feature branch.
3.  Commit your changes.
4.  Open a Pull Request.

## 📄 License
MIT — see [LICENSE](LICENSE).
