import React from 'react';
import { Button } from './UI';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_40px_-12px_rgba(15,27,45,.25)]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`rounded-full border border-line p-2 ${variant === 'danger' ? 'bg-negative/10' : 'bg-info/10'}`}
            >
              <AlertTriangle
                className={`h-6 w-6 ${variant === 'danger' ? 'text-negative' : 'text-info'}`}
              />
            </div>
            <h3 className="font-display text-lg text-ink">{title}</h3>
          </div>

          <p className="mb-6 leading-relaxed text-ink-soft">{message}</p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
