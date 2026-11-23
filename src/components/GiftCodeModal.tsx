import React, { useState } from 'react';
import { Gift, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserAccount, Language } from '../types';
import { playSound } from '../utils/audio';
import { redeemFirestoreGiftCode } from '../firebase';

interface GiftCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward?: (rewardType: 'coins' | 'balance', amount: number, code: string) => void;
  currentUser?: UserAccount | null;
  onShowToast: (msg: string) => void;
  language?: Language;
}

export const GiftCodeModal: React.FC<GiftCodeModalProps> = ({
  isOpen,
  onClose,
  onClaimReward,
  currentUser,
  onShowToast,
  language = 'bn'
}) => {
  const isBn = language === 'bn';
  const [codeInput, setCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanCode = codeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      playSound('error');
      setFeedback({ type: 'error', text: isBn ? 'অনুগ্রহ করে একটি গিফট কোড লিখুন!' : 'Please enter a gift code!' });
      return;
    }

    if (!currentUser) {
      playSound('error');
      setFeedback({
        type: 'error',
        text: isBn ? 'গিফট কোড রিডিম করতে আগে আপনার অ্যাকাউন্টে লগইন করুন!' : 'Please log in to redeem gift codes!'
      });
      return;
    }

    setIsRedeeming(true);
    playSound('coin');

    try {
      const res = await redeemFirestoreGiftCode(cleanCode, currentUser.id);
      if (res.success && res.type && typeof res.amount === 'number') {
        playSound('success');
        setFeedback({ type: 'success', text: res.message });
        onShowToast(res.message);
        if (onClaimReward) {
          onClaimReward(res.type, res.amount, cleanCode);
        }
        setCodeInput('');
      } else {
        playSound('error');
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: unknown) {
      playSound('error');
      const msg = (err as Error)?.message || (isBn ? 'গিফট কোড প্রসেস করতে সমস্যা হয়েছে!' : 'Failed to process gift code.');
      setFeedback({ type: 'error', text: msg });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-auto w-full max-w-[436px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-400/50 overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {isBn ? 'গিফট কোড রিওয়ার্ড' : 'Gift Code Rewards'}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-slate-950">
                  REWARD
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn ? 'অ্যাডমিন কর্তৃক প্রদত্ত অফিসিয়াল গিফট কোড রিডিম করুন' : 'Redeem official promo gift codes from Admin'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { playSound('click'); onClose(); }}
            className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
            title="বন্ধ করুন (×)"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isBn ? 'আপনার গিফট কোডটি লিখুন:' : 'Enter Your Gift Code:'}</span>
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value.toUpperCase());
                    if (feedback) setFeedback(null);
                  }}
                  placeholder={isBn ? "যেমন: BONUS100 বা TASK2026" : "e.g., BONUS100 or TASK2026"}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-amber-300 dark:border-amber-700/80 text-base font-mono font-black text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 uppercase tracking-widest text-center shadow-inner"
                />
              </div>
            </div>

            {feedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 leading-relaxed ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isRedeeming}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Gift className="w-4 h-4" />
              <span>{isRedeeming ? (isBn ? 'কোড যাচাই করা হচ্ছে...' : 'Verifying Code...') : (isBn ? 'কোড রিডিম করুন' : 'Claim Gift Reward')}</span>
            </button>
          </form>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-center text-xs text-slate-500 dark:text-slate-400">
            {isBn
              ? '💡 গিফট কোড পেতে অ্যাডমিনের নোটিশ বোর্ড অথবা অফিশিয়াল চ্যানেল লক্ষ্য রাখুন।'
              : '💡 Watch out for official promo codes released by the Admin.'}
          </div>

        </div>

      </div>
    </div>
  );
};
