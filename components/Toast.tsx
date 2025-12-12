
import React from 'react';
import { useToastStore } from '../stores/useToastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export const ToastContainer = () => {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-full duration-300 min-w-[300px]",
                        toast.type === 'success' ? "bg-white border-green-200 text-green-800" :
                        toast.type === 'error' ? "bg-white border-red-200 text-red-800" :
                        "bg-white border-gray-200 text-gray-800"
                    )}
                >
                    {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
                    {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
                    
                    <p className="text-sm font-medium flex-1">{toast.message}</p>
                    
                    <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
