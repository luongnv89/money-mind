import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export const ConnectionTestResult: React.FC<{
  result: 'success' | 'error' | null;
  message: string;
}> = ({ result, message }) => (
  <div className="flex-1">
    {result === 'success' && (
      <div className="text-sm text-positive flex items-center gap-1 font-medium animate-rise bg-accent-light p-3 rounded-lg border border-line">
        <CheckCircle className="w-4 h-4 shrink-0" /> {message}
      </div>
    )}
    {result === 'error' && (
      <div className="text-sm text-negative flex items-start gap-2 animate-rise bg-negative/10 p-3 rounded-lg border border-negative/20">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="whitespace-pre-wrap font-medium font-mono text-xs">{message}</div>
      </div>
    )}
  </div>
);
