import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, Coins, CheckCircle2, AlertCircle, RefreshCw, Loader2, WifiOff } from 'lucide-react';
import { Language, QuizQuestion } from '../types';
import { fetchQuizQuestions } from '../utils/quizApi';
import { playSound } from '../utils/audio';

interface QuizJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  balance: number;
  onWinQuizCoins: (coinsWon: number) => Promise<void> | void;
  onConvertCoins: () => Promise<void> | void;
  onShowToast: (msg: string) => void;
  onTaskSubmitted?: () => void;
  language?: Language;
  questions?: QuizQuestion[];
  isLoading?: boolean;
  error?: string | null;
  onFetchQuestions?: () => Promise<void> | void;
  onConsumeQuestion?: (questionId: string) => void;
  apiEndpoint?: string;
}

export const QuizJobModal: React.FC<QuizJobModalProps> = ({
  isOpen,
  onClose,
  coins,
  balance,
  onWinQuizCoins,
  onConvertCoins,
  onShowToast,
  onTaskSubmitted,
  language = 'bn',
  questions: externalQuestions,
  isLoading: externalLoading,
  error: externalError,
  onFetchQuestions,
  onConsumeQuestion,
  apiEndpoint
}) => {
  const isBn = language === 'bn';
  const isExternallyManaged = Boolean(onFetchQuestions && externalQuestions !== undefined);

  const [internalQueue, setInternalQueue] = useState<QuizQuestion[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [solvedCount, setSolvedCount] = useState(0);
  const [isProcessingReward, setIsProcessingReward] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadInternalBatch = useCallback(async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      const fetched = await fetchQuizQuestions(apiEndpoint);
      setInternalQueue(prev => {
        const seen = new Set(prev.map(q => q.question));
        const unique = fetched.filter(q => !seen.has(q.question));
        return [...prev, ...(unique.length > 0 ? unique : fetched)];
      });
    } catch {
      setInternalError(
        isBn
          ? 'কুইজ সার্ভার থেকে প্রশ্ন লোড করা যায়নি। পুনরায় চেষ্টা করুন।'
          : 'Unable to fetch quiz questions from the external API. Please retry.'
      );
    } finally {
      setInternalLoading(false);
    }
  }, [apiEndpoint, isBn]);

  const queue = isExternallyManaged ? externalQuestions || [] : internalQueue;
  const loading = isExternallyManaged ? Boolean(externalLoading) : internalLoading;
  const errorMsg = isExternallyManaged ? externalError || null : internalError;
  const currentQuestion = queue[0] || null;

  const triggerRefetch = useCallback(() => {
    if (isExternallyManaged && onFetchQuestions) {
      void onFetchQuestions();
    } else {
      void loadInternalBatch();
    }
  }, [isExternallyManaged, onFetchQuestions, loadInternalBatch]);

  // Fetch initial or replenishment batch dynamically when modal opens or queue runs low
  useEffect(() => {
    if (!isOpen) return;
    if (queue.length <= 3 && !loading && !errorMsg) {
      triggerRefetch();
    }
  }, [isOpen, queue.length, loading, errorMsg, triggerRefetch]);

  if (!isOpen) return null;

  const canConvert = coins >= 1000;
  const progressPct = Math.min(100, Math.round((coins / 1000) * 100));

  const advanceToNextQuestion = (consumedId: string) => {
    if (isExternallyManaged && onConsumeQuestion) {
      onConsumeQuestion(consumedId);
    } else {
      setInternalQueue(prev => prev.filter(q => q.id !== consumedId));
    }
  };

  const handleOptionSelect = async (idx: number) => {
    if (!currentQuestion || isProcessingReward) return;

    const rewardCoins = currentQuestion.reward || 50;
    const completedQuestionId = currentQuestion.id;

    if (idx === currentQuestion.correctIndex) {
      setIsProcessingReward(true);

      try {
        await onWinQuizCoins(rewardCoins);

        if (!isMountedRef.current) return;

        playSound('coin');
        setSolvedCount(prev => prev + 1);
        setFeedback({
          type: 'success',
          text: isBn
            ? `অভিনন্দন! সঠিক উত্তর। +${rewardCoins} কয়েন আপনার কয়েন ওয়ালেটে যোগ হয়েছে!`
            : `Correct! +${rewardCoins} Coins added to your Coin Wallet!`
        });
        onShowToast(isBn ? `+${rewardCoins} কয়েন যোগ হয়েছে!` : `+${rewardCoins} Coins earned!`);
        advanceToNextQuestion(completedQuestionId);
        onTaskSubmitted?.();
      } finally {
        if (isMountedRef.current) {
          setIsProcessingReward(false);
        }
      }
    } else {
      // WRONG ANSWER PENALTY: Do NOT allow retry on the same question — immediately skip to the next fetched question!
      playSound('error');
      advanceToNextQuestion(completedQuestionId);
      setFeedback({
        type: 'error',
        text: isBn
          ? 'ভুল উত্তর! একই প্রশ্ন পুনরায় করার সুযোগ নেই — পরবর্তী নতুন প্রশ্ন লোড হয়েছে।'
          : 'Wrong answer! Penalty: skipped immediately to a new question.'
      });
      onTaskSubmitted?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-auto w-full max-w-[436px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Modal Header with Prominent Top-Right Close (×) Button */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                  {isBn ? 'কুইজ জব (Quiz Job)' : 'Quiz Job'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                  +৫০ কয়েন
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isBn
                  ? 'বাংলা সাধারণ জ্ঞান কুইজ • +৫০ কয়েন'
                  : 'Bengali General Knowledge Quiz • +50 Coins'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessingReward}
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 disabled:opacity-40"
            aria-label="Close Quiz Job Modal"
            title={isBn ? 'বন্ধ করুন (×)' : 'Close (×)'}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
          
          {/* Persistent Coin Wallet & Instant 1,000 Coin Conversion Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-300/70 dark:border-amber-700/60 space-y-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isBn ? 'কয়েন ওয়ালেট' : 'Coin Wallet'}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      ১,০০০ কয়েন = ৳১.০০
                    </span>
                  </div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {coins.toLocaleString('bn-BD')} {isBn ? 'কয়েন' : 'Coins'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!canConvert || isProcessingReward}
                onClick={() => {
                  playSound('click');
                  void onConvertCoins();
                }}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  canConvert && !isProcessingReward
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isBn ? 'কনভার্ট করুন (৳১.০০)' : 'Convert Coins (৳1.00)'}</span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span>
                  {isBn ? 'মূল ওয়ালেট ব্যালেন্স:' : 'Main Wallet:'}{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    ৳{balance.toFixed(2)} BDT
                  </strong>
                </span>
                <span>{Math.min(coins, 1000)} / 1000</span>
              </div>
              <svg
                viewBox="0 0 100 4"
                preserveAspectRatio="none"
                className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden block"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="quizCoinProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width={progressPct} height="4" fill="url(#quizCoinProgressGrad)" />
              </svg>
            </div>
          </div>

          {/* Dynamic API Quiz Question Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            {currentQuestion ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {currentQuestion.category || (isBn ? 'সাধারণ জ্ঞান কুইজ' : 'General Knowledge')}
                    </span>
                    {loading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    )}
                  </div>
                  <span>
                    {isBn ? `সঠিক উত্তর: ${solvedCount}টি` : `Correct: ${solvedCount}`}
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                  {currentQuestion.question}
                </h4>

                <div className="space-y-2.5">
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={`${currentQuestion.id}-${idx}`}
                      type="button"
                      disabled={isProcessingReward}
                      onClick={() => { void handleOptionSelect(idx); }}
                      className="w-full text-left p-3.5 rounded-xl border-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait"
                    >
                      {idx + 1}. {option}
                    </button>
                  ))}
                </div>
              </>
            ) : loading ? (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  {isBn
                    ? 'সার্ভার থেকে নতুন কুইজ প্রশ্ন লোড হচ্ছে...'
                    : 'Fetching dynamic quiz questions from API...'}
                </p>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <WifiOff className="w-8 h-8 text-rose-500" />
                <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 max-w-xs">
                  {errorMsg ||
                    (isBn
                      ? 'এক্সটার্নাল কুইজ API থেকে প্রশ্ন পাওয়া যায়নি।'
                      : 'Could not load questions from external Quiz API.')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    triggerRefetch();
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isBn ? 'আবার চেষ্টা করুন' : 'Retry API Fetch'}</span>
                </button>
              </div>
            )}

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-center ${
                  feedback.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
            {isBn
              ? 'বিজ্ঞাপনমুক্ত ডাইনামিক কুইজ জোন • শুধুমাত্র সঠিক উত্তরের জন্যই কয়েন প্রদান করা হয়'
              : 'Ad-free dynamic quiz zone • Coins are awarded strictly for accurate answers'}
          </p>

        </div>
      </div>
    </div>
  );
};
