import React from 'react';
import { Button, Card, CardContent, Eyebrow } from '../components/UI';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card>
    <CardContent className="p-6">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </CardContent>
  </Card>
);

const BulletList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc space-y-2 pl-5">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

export const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <Eyebrow>MoneyMind</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-ink">Privacy</h1>
      </div>
      <Button variant="outline" size="sm" onClick={onBack}>
        Back
      </Button>
    </div>

    <p className="text-base leading-relaxed text-ink-soft">
      MoneyMind is local-first. There is no account, no server database and no analytics. Your
      statements are parsed and analysed in your browser.
    </p>

    <Section title="What stays on your device">
      <BulletList
        items={[
          "Transactions, learned rules and settings are stored in this browser's local storage.",
          'Metrics, the health score and advice are calculated on this device with fixed formulas.',
          'API keys are stored in this browser, obfuscated but not encrypted. Anyone with access to this browser profile could read them.',
        ]}
      />
    </Section>

    <Section title="What leaves your device — only for the services you set up">
      <BulletList
        items={[
          "TypeSafe Jev (categorization): each transaction's description, direction (in or out), amount and your bank's category label, relayed through this app's /typesafe-api pass-through.",
          'Gemini, Groq or a custom endpoint (fallback categorization): transaction descriptions, amounts and bank category labels.',
          'Gemini, Groq or a custom endpoint (Assistant): your question plus a summary of the selected period — totals, category breakdown, top merchants, recurring charges and findings. Never your full transaction list.',
          'Ollama: requests go to the Ollama server you configured, usually on your own computer.',
          "Each provider's own privacy terms apply to what it receives. On Google's free tier, prompts may be used to improve Google's products.",
        ]}
      />
    </Section>

    <Section title="Your control">
      <BulletList
        items={[
          'See everything: the Transactions page lists every stored transaction.',
          'Export: download your categorized transactions as CSV from the Transactions page, and your rules from Settings.',
          'Delete: Settings → Delete data & reset removes transactions, rules or settings from this browser.',
        ]}
      />
    </Section>

    <Section title="Contact">
      <p>
        For privacy concerns or code audit requests, contact the developer:
        <br />
        <strong className="text-ink">Email:</strong>{' '}
        <a href="mailto:luongnv89@gmail.com" className="text-accent hover:underline">
          luongnv89@gmail.com
        </a>
        <br />
        <strong className="text-ink">GitHub:</strong>{' '}
        <a
          href="https://github.com/luongnv89/money-mind"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          luongnv89/money-mind
        </a>
      </p>
      <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
        Last updated: September 27, 2026
      </p>
    </Section>
  </div>
);
