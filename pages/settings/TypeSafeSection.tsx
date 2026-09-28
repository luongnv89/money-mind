import React from 'react';
import { Key, PlayCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '../../components/UI';
import { ConnectionTestResult } from './shared';

interface TypeSafeSectionProps {
  /** Deobfuscated key shown in the input. */
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: 'success' | 'error' | null;
  testMessage: string;
}

/** TypeSafe Jev card — key input, what-it-does copy and connection test. */
export const TypeSafeSection: React.FC<TypeSafeSectionProps> = ({
  apiKey,
  onApiKeyChange,
  onTest,
  isTesting,
  testResult,
  testMessage,
}) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center gap-3">
        <CardTitle>TypeSafe Jev</CardTitle>
        <Badge variant="positive">Recommended for categorization</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          What it does
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Sorts each transaction into your budget categories (Income, Must-have, Nice-to-have,
          Waste, Save, Invest, Internal transfer) and returns a calibrated probability. Results
          below 50% are flagged for your review instead of being guessed, and identical transactions
          are sent once so they always get the same answer.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          What is sent
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Each transaction&apos;s description, direction (money in or out), amount and your
          bank&apos;s category label. Never your name or account numbers. Requests go through this
          app&apos;s /typesafe-api relay because TypeSafe doesn&apos;t accept direct browser calls.
        </p>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="typesafe-api-key"
          className="text-sm font-medium text-ink flex items-center gap-2"
        >
          <Key className="w-4 h-4" /> TypeSafe API Key
        </label>
        <Input
          id="typesafe-api-key"
          type="password"
          placeholder="Enter your TypeSafe API key"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="font-mono"
        />
        <p className="text-xs text-muted">
          Get one at{' '}
          <a
            href="https://console.typesafe.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            console.typesafe.ai
          </a>
          . Stored in this browser only (obfuscated, not encrypted).
        </p>
      </div>
      <div className="pt-4 border-t border-line">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <ConnectionTestResult result={testResult} message={testMessage} />
          <Button
            onClick={onTest}
            isLoading={isTesting}
            className="shrink-0"
            variant={testResult === 'success' ? 'outline' : 'primary'}
          >
            {isTesting ? (
              'Testing...'
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Test TypeSafe
              </>
            )}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
