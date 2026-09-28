import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, Send, X } from 'lucide-react';
import { AI_PROVIDER_LABELS } from '../constants';
import {
  Period,
  buildAssistantContext,
  buildFinanceModel,
  periodContaining,
  periodFor,
} from '../lib/finance';
import { useLedger } from '../lib/useFinance';
import { cn, formatCurrency } from '../lib/utils';
import { chatWithFinancialAgent } from '../services/aiService';
import { useAIReady, useSettingsStore } from '../stores/useSettingsStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useViewStore } from '../stores/useViewStore';
import { View } from '../types';
import { Button } from './UI';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Where did most of my money go this period?',
  'How can I reach a 20% savings rate?',
  'Which recurring charges could I cancel?',
  'How does this period compare with my average?',
];

export interface AssistantChatProps {
  onNavigate?: (view: View) => void;
}

/**
 * Floating MoneyMind assistant. Answers are written by the configured
 * language model over the engine-built FINANCIAL CONTEXT — the model is
 * never asked to compute figures from raw transactions.
 */
export const AssistantChat: React.FC<AssistantChatProps> = ({ onNavigate }) => {
  const transactions = useTransactionStore((s) => s.transactions);
  const aiMode = useSettingsStore((s) => s.aiMode);
  const currency = useSettingsStore((s) => s.currency);
  const geminiModel = useSettingsStore((s) => s.geminiConfig.model);
  const groqModel = useSettingsStore((s) => s.groqConfig.model);
  const ollamaModel = useSettingsStore((s) => s.ollamaConfig.model);
  const customModel = useSettingsStore((s) => s.customConfig.model);
  const isAIReady = useAIReady();
  const ledger = useLedger();
  const granularity = useViewStore((s) => s.granularity);
  const anchor = useViewStore((s) => s.anchor);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [completedReply, setCompletedReply] = useState({ id: 0, content: '' });
  const replyIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);

  // The period the Overview/Transactions pages are showing; falls back to the
  // latest month of data so an "All time" or empty selection still has context.
  const period: Period | null = useMemo(() => {
    const selected = periodFor(ledger, granularity, anchor);
    if (selected && granularity !== 'all') return selected;
    if (selected) return selected;
    return ledger.bounds ? periodContaining('month', ledger.bounds.last) : null;
  }, [ledger, granularity, anchor]);

  const providerLabel = AI_PROVIDER_LABELS[aiMode];
  const modelName =
    aiMode === 'cloud'
      ? geminiModel
      : aiMode === 'groq'
        ? groqModel
        : aiMode === 'custom'
          ? customModel
          : ollamaModel;
  const configured = isAIReady;

  const announceReply = (content: string) => {
    replyIdRef.current += 1;
    setCompletedReply({ id: replyIdRef.current, content });
  };

  useEffect(() => {
    if (isOpen) {
      hasOpened.current = true;
      closeRef.current?.focus();
    } else if (hasOpened.current) {
      launcherRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (transactions.length === 0) return null;

  const buildContext = (): string => {
    if (!period) return '';
    const fmt = (n: number) => formatCurrency(n, currency);
    const model = buildFinanceModel(ledger, period, fmt);
    return buildAssistantContext(model, fmt, currency);
  };

  const send = async (text: string) => {
    const query = text.trim();
    if (!query || isLoading || !configured) return;
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setInput('');
    setIsLoading(true);
    try {
      const reply = await chatWithFinancialAgent(query, buildContext());
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      announceReply(reply);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const reply = `The assistant couldn't answer: ${message}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      announceReply(reply);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <p role="status" className="sr-only">
        MoneyMind Assistant chat is available.
      </p>
      {/* Keep this region mounted from the first render so completed replies are announced reliably. */}
      <div
        data-testid="assistant-reply-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        <span key={completedReply.id}>{completedReply.content}</span>
      </div>

      {!isOpen && (
        <button
          ref={launcherRef}
          type="button"
          aria-label="Open MoneyMind Assistant"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-ink text-paper shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <MessageSquareText className="h-5 w-5" />
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="MoneyMind Assistant"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
          className={cn(
            'fixed z-40 flex flex-col overflow-hidden border border-line bg-surface shadow-xl',
            // Mobile (<640px): bottom-anchored sheet capped below the sticky header.
            'inset-x-3 bottom-3 max-h-[calc(100dvh-6rem)] rounded-2xl',
            // Desktop: anchored panel above the FAB.
            'sm:inset-x-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[540px] sm:w-96'
          )}
        >
          <div className="border-b border-line bg-surface-muted/60 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg text-ink">Assistant</p>
                <p className="text-xs text-muted">
                  Answers use the figures on your Overview for {period?.label ?? 'your data'}.
                </p>
                {configured && (
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                    {providerLabel} · {modelName}
                  </p>
                )}
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close assistant"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-muted transition-colors hover:bg-line/60 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!configured ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  The Assistant needs a language model to write answers. Your metrics, score and
                  advice work without it.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate?.('settings');
                  }}
                >
                  Set up in Settings
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">Ask about your spending, savings or budget.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="rounded-full border border-line bg-surface-muted/60 px-3 py-1.5 text-left text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'ml-auto bg-ink text-paper'
                      : 'mr-auto bg-surface-muted text-ink'
                  )}
                >
                  {message.content}
                </div>
              ))
            )}
            {isLoading && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl bg-surface-muted px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {configured && (
            <form
              className="flex items-center gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the Assistant…"
                aria-label="Ask the Assistant"
                className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !input.trim()}
                aria-label="Send"
                className="rounded-full px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
};
