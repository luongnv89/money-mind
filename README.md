
# MoneyMind 🧠💰

MoneyMind is a privacy-first, serverless financial analyzer built with React. It uses on-device AI (via WebLLM/Ollama) or Cloud AI (Gemini/Groq) to categorize transactions, detect spending patterns, and provide "sassy" financial advice—all without storing your data on a backend server.

## 🚀 Features

-   **Zero-Knowledge Privacy:** CSV processing happens 100% in the browser. API keys are encrypted in LocalStorage.
-   **AI Categorization:** Automatically categorizes messy bank transactions using LLMs.
-   **Multi-Model Support:**
    -   ☁️ **Cloud:** Google Gemini (Default), Groq (Fastest).
    -   🏠 **Local:** Ollama (Private, no cost).
-   **Smart Learning:** "Verify" transactions to teach the app your specific preferences (stored locally).
-   **Sassy Financial Assistant:** Chat with "MonkeySmile," a persona that roasts or toasts your spending habits.
-   **Visual Insights:** Interactive charts for monthly performance, spending mix, and financial health scoring.

## 🛠 Tech Stack

-   **Frontend:** React 19, TypeScript, Vite
-   **Serverless Backend:** Vercel Functions (in `api/` folder)
-   **State Management:** Zustand (with LocalStorage persistence)
-   **Styling:** Tailwind CSS, Lucide React (Icons)
-   **AI Integration:** Google GenAI SDK, Custom REST connectors for Groq/Ollama
-   **Parsing:** PapaParse (CSV)
-   **Visualization:** Recharts

## ⚙️ Setup & Installation

### Prerequisites
-   **Node.js 24+ (LTS)**
-   **NPM** (or Yarn/PNPM)
-   (Optional) **Vercel CLI** for testing serverless functions locally: `npm i -g vercel`
-   (Optional) **Ollama** for local AI: [ollama.com](https://ollama.com)

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/moneymind.git
    cd moneymind
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory (or copy from `.env.example`):
    ```bash
    cp .env.example .env
    ```
    Add your API keys to `.env`:
    ```env
    GEMINI_API_KEY=your_google_gemini_api_key
    GROQ_API_KEY=your_groq_api_key
    ```
    *Note: You can also configure these keys directly within the application's **Settings** page.*

4.  **Start the development server:**

    **Option A: Standard Vite Dev (Frontend Only)**
    ```bash
    npm run dev
    ```
    This starts the app at `http://localhost:3000`. The frontend will use the keys from `.env` or your in-app settings.

    **Option B: Full-Stack Dev (with Serverless Functions)**
    If you want to test the serverless endpoints in the `api/` folder:
    ```bash
    vercel dev
    ```
    This requires the Vercel CLI and will simulate the production environment.

### Deployment

#### 1. Static Site Deployment (SPA)
MoneyMind is primarily a Single Page Application (SPA). You can deploy it to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.):

1.  **Build the project:**
    ```bash
    npm run build
    ```
2.  **Deploy the `dist/` folder.**
    Ensure your hosting provider is configured to redirect all requests to `index.html` (standard SPA routing).

#### 2. Vercel Deployment (Full-Stack)
If you want to utilize the serverless functions in the `api/` directory (e.g., for the demo chat proxy):

1.  Push your code to a GitHub repository.
2.  Connect the repository to **Vercel**.
3.  Add your `GEMINI_API_KEY` or `API_KEY` to the **Environment Variables** in the Vercel project settings.
4.  Vercel will automatically detect the `api/` folder and deploy the functions.

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
1.  **Quality Job:** Runs Lint, Format Check, and Type Check.
2.  **Security Job:** Runs **Trivy** (vulnerability scanning) and **Gitleaks** (secret detection).

## ⚠️ Security Note
This application deals with financial data.
1.  **Do not commit API Keys.** Use `.env` files or the in-app Settings page.
2.  The app is designed to be client-side only. There is no database. Clearing your browser cache will delete your transaction history and learned patterns.

## 🤝 Contributing
1.  Fork the repo.
2.  Create a feature branch.
3.  Commit your changes.
4.  Open a Pull Request.

## 📄 License
MIT
