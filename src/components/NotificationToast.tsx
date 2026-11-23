import React from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

interface NotificationToastProps {
  message: string | null;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[85] w-[calc(100%-1.5rem)] max-w-[432px] bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 p-3.5 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-start gap-3 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-1 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="flex-1 text-xs sm:text-sm font-semibold leading-snug">
        {message}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white dark:hover:text-slate-900 transition-colors cursor-pointer shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
