import { useToastStore } from '../stores/useToastStore';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ToastType } from '../stores/useToastStore';

const TOAST_STYLE: Record<ToastType, { Icon: typeof Info; icon: string; border: string }> = {
  success: { Icon: CheckCircle, icon: 'text-positive', border: 'border-l-positive' },
  error: { Icon: AlertCircle, icon: 'text-negative', border: 'border-l-negative' },
  warning: { Icon: AlertTriangle, icon: 'text-warning', border: 'border-l-warning' },
  info: { Icon: Info, icon: 'text-info', border: 'border-l-info' },
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-28 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-[380px]"
    >
      {toasts.map((toast) => {
        const { Icon, icon, border } = TOAST_STYLE[toast.type];
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : undefined}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-line ${border} border-l-[3px] bg-surface px-4 py-3 text-ink shadow-[0_1px_2px_rgba(15,27,45,.04),0_8px_24px_-12px_rgba(15,27,45,.16)] animate-rise`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} />
            <p className="flex-1 pt-0.5 text-sm font-medium leading-snug">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-0.5 rounded-md p-1 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
