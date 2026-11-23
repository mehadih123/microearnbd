import React, { useState } from 'react';
import { 
  History, 
  X, 
  CheckCircle2, 
  Clock, 
  Coins, 
  DollarSign, 
  Calculator, 
  HelpCircle, 
  ShieldCheck, 
  Briefcase, 
  Gift, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Transaction, UserAccount, Language } from '../types';
import { playSound } from '../utils/audio';

interface TaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  currentUser?: UserAccount | null;
  language?: Language;
}

export const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({
  isOpen,
  onClose,
  transactions = [],
  currentUser,
  language = 'bn'
}) => {
  const isBn = language === 'bn';
  const [filter, setFilter] = useState<'all' | 'tasks' | 'withdrawals' | 'commissions'>('all');

  if (!isOpen) return null;

  // Strict User Isolation: only display transactions belonging to currentUser
  const userOnlyTransactions = transactions.filter(tx => {
    if (!currentUser) return false;
    if (tx.userId && tx.userId !== currentUser.id) return false;
    return true;
  });

  // Filter transactions
  const filtered = userOnlyTransactions.filter(tx => {
    if (filter === 'tasks') {
      return (
        tx.type === 'coin_reward' ||
        tx.type === 'coin_convert' ||
        tx.type === 'task_reward' ||
        tx.type === 'math_reward' ||
        tx.type === 'quiz_reward' ||
        tx.type === 'captcha_reward' ||
        tx.title.includes('ম্যাথ') ||
        tx.title.includes('কুইজ') ||
        tx.title.includes('ক্যাপচা') ||
        tx.title.includes('টাস্ক')
      );
    }
    if (filter === 'withdrawals') {
      return tx.type === 'withdrawal' || tx.type === 'withdrawal_refund' || tx.title.includes('ক্যাশআউট') || tx.title.includes('উইথড্রয়াল');
    }
    if (filter === 'commissions') {
      return (
        tx.type === 'referral' ||
        tx.type === 'referral_bonus' ||
        tx.type === 'resell_commission' ||
        tx.title.includes('কমিশন') ||
        tx.title.includes('রেফারেল')
      );
    }
    return true;
  });

  const getTxIcon = (tx: Transaction) => {
    if (tx.title.includes('ম্যাথ')) return <Calculator className="w-4 h-4 text-teal-500" />;
    if (tx.title.includes('কুইজ')) return <HelpCircle className="w-4 h-4 text-amber-500" />;
    if (tx.title.includes('ক্যাপচা')) return <ShieldCheck className="w-4 h-4 text-indigo-500" />;
    if (tx.title.includes('স্পিন')) return <Sparkles className="w-4 h-4 text-purple-500" />;
    if (tx.title.includes('গিফট') || tx.title.includes('কোড')) return <Gift className="w-4 h-4 text-pink-500" />;
    if (tx.type === 'withdrawal' || tx.title.includes('ক্যাশআউট')) return <ArrowUpRight className="w-4 h-4 text-rose-500" />;
    if (tx.type === 'resell_commission' || tx.title.includes('কমিশন')) return <DollarSign className="w-4 h-4 text-emerald-500" />;
    if (tx.type === 'task_reward' || tx.title.includes('মাইক্রো')) return <Briefcase className="w-4 h-4 text-cyan-500" />;
    return <Coins className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-auto w-full max-w-[436px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {isBn ? 'টাস্ক ও উপার্জনের হিসেব বিবরণী' : 'Task & Earnings History'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {userOnlyTransactions.length} টি রেকর্ড
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn ? 'আপনার সম্পন্নকৃত সকল কাজ, কয়েন আর্ন এবং উইথড্রয়ালের সম্পূর্ণ তালিকা' : 'Detailed breakdown of all completed tasks and earnings'}
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

        {/* Filter Navigation */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
          <button
            type="button"
            onClick={() => { playSound('click'); setFilter('all'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isBn ? 'সব হিস্ট্রি' : 'All'} ({userOnlyTransactions.length})
          </button>

          <button
            type="button"
            onClick={() => { playSound('click'); setFilter('tasks'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filter === 'tasks'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isBn ? 'টাস্ক ও কুইজ' : 'Tasks & Quizzes'}
          </button>

          <button
            type="button"
            onClick={() => { playSound('click'); setFilter('withdrawals'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filter === 'withdrawals'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isBn ? 'উইথড্রয়াল' : 'Withdrawals'}
          </button>

          <button
            type="button"
            onClick={() => { playSound('click'); setFilter('commissions'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filter === 'commissions'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isBn ? 'কমিশন' : 'Commissions'}
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <History className="w-10 h-10 mx-auto opacity-40 text-slate-500" />
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">
                {isBn ? 'কোনো লেনদেন বা টাস্ক রেকর্ড পাওয়া যায়নি' : 'No activity records found'}
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {isBn ? 'ম্যাথ, কুইজ বা মাইক্রো-টাস্ক সমাধান করলেই আপনার আয় এখানে স্বয়ংক্রিয়ভাবে তালিকাভুক্ত হবে।' : 'Complete tasks to see your activity logged here.'}
              </p>
            </div>
          ) : (
            filtered.map((tx) => {
              const isDebit = tx.amount < 0 || tx.type === 'withdrawal';
              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                      {getTxIcon(tx)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {tx.title}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-mono">{tx.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-extrabold font-mono ${
                        isDebit
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isDebit ? '' : '+'}{typeof tx.amount === 'number' ? (tx.amount >= 50 && tx.amount % 50 === 0 && !tx.title.includes('৳') ? `${tx.amount} কয়েন` : `৳${Math.abs(tx.amount).toFixed(2)}`) : tx.amount}
                    </div>
                    <span
                      className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full mt-0.5 ${
                        tx.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : tx.status === 'pending'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {tx.status === 'completed' ? 'সফল' : tx.status === 'pending' ? 'পেন্ডিং' : 'বাতিল'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>মোট ব্যালেন্স: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">৳{(currentUser?.balance || 0).toFixed(2)}</strong></span>
          <span>কয়েন: <strong className="text-amber-500 font-mono">{currentUser?.coins || 0}</strong></span>
        </div>

      </div>
    </div>
  );
};
