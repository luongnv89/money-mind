import { useToastStore } from '../stores/useToastStore';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-full duration-300 min-w-[320px] max-w-sm backdrop-blur-sm',
            toast.type === 'success' && 'bg-green-50/95 border-green-200 text-green-900',
            toast.type === 'error' && 'bg-red-50/95 border-red-200 text-red-900',
            toast.type === 'warning' && 'bg-amber-50/95 border-amber-200 text-amber-900',
            toast.type === 'info' && 'bg-blue-50/95 border-blue-200 text-blue-900'
          )}
        >
          {toast.type === 'success' && (
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'warning' && (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}

          <p className="text-sm font-medium flex-1 leading-snug pt-0.5">{toast.message}</p>

          <button
            onClick={() => removeToast(toast.id)}
            className={cn(
              'transition-colors -mr-1 -mt-0.5 p-1 rounded-md',
              toast.type === 'success' && 'text-green-600 hover:bg-green-100',
              toast.type === 'error' && 'text-red-600 hover:bg-red-100',
              toast.type === 'warning' && 'text-amber-600 hover:bg-amber-100',
              toast.type === 'info' && 'text-blue-600 hover:bg-blue-100'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
