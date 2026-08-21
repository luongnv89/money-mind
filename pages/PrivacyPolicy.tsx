import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/UI';
import { Shield, Lock, Server } from 'lucide-react';

export const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <Button variant="outline" onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Privacy First Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            MoneyMind is designed with a "Local-First" architecture. We believe your financial data
            belongs to you, and strictly you. Unlike traditional finance apps, we do not have a
            backend database that stores your transaction history, account details, or personal
            identifiers.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <h3 className="font-semibold text-green-900 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Data Storage
              </h3>
              <p className="text-sm mt-2 text-green-800">
                All transaction data is stored inside your browser's <strong>LocalStorage</strong>.
                Clearing your browser cache deletes all data permanently.
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Server className="w-4 h-4" /> No Remote Database
              </h3>
              <p className="text-sm mt-2 text-blue-800">
                We do not maintain user accounts, passwords, or cloud databases. We cannot see,
                sell, or lose your data because we never have it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="prose prose-gray max-w-none bg-white p-8 rounded-lg border border-gray-200 shadow-xs">
        <h3>1. Data Collection & Usage</h3>
        <p>
          We process the CSV files you upload directly in your browser using JavaScript. The data is
          parsed to categorize expenses and generate insights.
        </p>
        <ul>
          <li>
            <strong>Financial Data:</strong> Transactions, dates, amounts, and descriptions from
            your uploaded files.
          </li>
          <li>
            <strong>API Keys:</strong> If you use Cloud AI (Google/Groq), your API keys are
            obfuscated and stored locally in your browser's LocalStorage (not encrypted).
          </li>
          <li>
            <strong>Usage Data:</strong> We do not track user behavior or analytics.
          </li>
        </ul>

        <h3>2. AI Processing</h3>
        <p>
          To provide categorization and "MonkeySmile" chat features, specific data snippets are sent
          to AI providers only when you explicitly trigger an action.
        </p>
        <ul>
          <li>
            <strong>Google Gemini / Groq:</strong> If configured, transaction descriptions are sent
            to these APIs for categorization.
          </li>
          <li>
            <strong>Local LLM (Ollama):</strong> If configured, data never leaves your machine.
          </li>
        </ul>

        <h3>3. GDPR & User Rights</h3>
        <p>Since we do not identify users or store data on servers, you have full control:</p>
        <ul>
          <li>
            <strong>Right to Access:</strong> You can view all your stored data on the Dashboard.
          </li>
          <li>
            <strong>Right to Erasure:</strong> Click the "Clear" button in the top navigation to
            instantly wipe all data from your browser.
          </li>
          <li>
            <strong>Right to Portability:</strong> You can export your processed data as CSV from
            the Dashboard.
          </li>
        </ul>

        <h3>4. Contact Us</h3>
        <p>
          For privacy concerns or code audit requests, please contact the developer:
          <br />
          <strong>Email:</strong>{' '}
          <a href="mailto:luongnv89@gmail.com" className="text-accent hover:underline">
            luongnv89@gmail.com
          </a>
          <br />
          <strong>GitHub:</strong>{' '}
          <a
            href="https://github.com/luongnv89/money-mind"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            luongnv89/money-mind
          </a>
        </p>

        <p className="text-sm text-gray-500 mt-8 pt-4 border-t">
          Last Updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};
