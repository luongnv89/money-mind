
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
-   Node.js v20+
-   NPM
-   (Optional) Vercel CLI for local serverless testing: `npm i -g vercel`

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/moneymind.git
    cd moneymind
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  **Configure API Key:**
    To use the serverless backend features (like the Demo Chat proxy), rename `.env.example` to `.env` and add your Google Gemini API key:
    ```bash
    cp .env.example .env
    ```
    Edit `.env`:
    ```env
    API_KEY=your_actual_api_key_here
    ```

4.  Start the development server:
    
    *Option A (Frontend Only):*
    ```bash
    npm run dev
    ```
    *Note: The `/api/chat` endpoint will not work in this mode unless you proxy it manually.*

    *Option B (Full Stack with Serverless):*
    ```bash
    vercel dev
    ```

## 🧪 Quality Assurance

We enforce a strict "Shift-Left" quality strategy.

### Manual Commands
-   `npm run lint`: Run ESLint.
-   `npm run format`: Fix formatting issues.
-   `npm run typecheck`: Run TypeScript compiler.

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
