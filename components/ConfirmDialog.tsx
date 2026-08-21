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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'}`}
            >
              <AlertTriangle
                className={`w-6 h-6 ${variant === 'danger' ? 'text-red-600' : 'text-blue-600'}`}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>

          <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>

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
