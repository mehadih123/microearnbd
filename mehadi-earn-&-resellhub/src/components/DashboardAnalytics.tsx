import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Wallet, 
  ShoppingBag, 
  Briefcase, 
  Coins,
  RefreshCw,
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2
} from 'lucide-react';
import { Transaction } from '../types';
import { playSound } from '../utils/audio';

interface DashboardAnalyticsProps {
  balance: number;
  coins: number;
  onConvertCoins: () => void;
  transactions: Transaction[];
  onOpenWallet: () => void;
  onClose?: () => void;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  balance,
  coins,
  onConvertCoins,
  transactions,
  onOpenWallet,
  onClose
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  // Strictly real calculations — ZERO fake/inflated demo numbers or referral stats
  const lifetimeEarnings = transactions
    .filter(t => t.type !== 'withdrawal' && t.type !== 'job_posting')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const completedJobsCount = transactions.filter(t => t.type === 'micro_job').length;
  const completedOrdersCount = transactions.filter(t => t.type === 'resell_commission' && t.status === 'completed').length;

  const filteredTransactions = transactions.filter(t => {
    if (filterType === 'all') return true;
    if (filterType === 'commission') return t.type === 'resell_commission';
    if (filterType === 'job') return t.type === 'micro_job';
    if (filterType === 'quiz') return t.type === 'quiz_reward' || t.type === 'math_reward';
    if (filterType === 'withdraw') return t.type === 'withdrawal';
    return true;
  });

  const canConvert = coins >= 1000;

  return (
    <section id="dashboard" className="pb-6 relative bg-slate-50/60 dark:bg-slate-900/40 w-full max-w-full overflow-x-clip">
      {/* Sticky Sub-View Top Bar with Always-Visible Close (×) Button */}
      {onClose && (
        <div className="sticky top-[calc(60px+env(safe-area-inset-top,0px))] z-40 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              আর্নিংস ও ওয়ালেট ড্যাশবোর্ড
            </span>
          </div>
          <button
            type="button"
            onClick={() => { playSound('click'); onClose(); }}
            className="w-11 h-11 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
            aria-label="Close and return home"
            title="হোমে ফিরে যান (×)"
          >
            &times;
          </button>
        </div>
      )}

      <div className="w-full px-3.5 pt-5">
        
        {/* Section Header */}
        <div className="flex flex-col gap-3 mb-6 min-w-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              আর্নিংস ও ওয়ালেট সামারি
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              আপনার আয়ের ড্যাশবোর্ড
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              রিসেলিং কমিশন, মাইক্রো-টাস্ক ও কয়েন কনভার্ট থেকে আপনার প্রকৃত ইনকাম বিবরণী।
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start">
            <button
              onClick={() => { playSound('click'); onOpenWallet(); }}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>টাকা তুলুন (Withdraw)</span>
            </button>
          </div>
        </div>

        {/* Coin Wallet & Instant 1,000 Coin Conversion Card */}
        <div className="mb-6 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700/60 shadow-md flex flex-col items-stretch justify-between gap-3.5 min-w-0">
          <div className="flex items-center gap-3.5 w-full min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Coins className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">কয়েন ওয়ালেট (Coin Wallet)</h3>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  · ১,০০০ কয়েন = ৳১.০০ BDT
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                {coins.toLocaleString('bn-BD')} কয়েন
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!canConvert}
            onClick={() => { playSound('click'); onConvertCoins(); }}
            className={`w-full min-h-[44px] px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 text-center transition-all shadow-sm ${
              canConvert
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span className="break-words">কয়েন কনভার্ট করুন (১,০০০ কয়েন = ৳১.০০)</span>
          </button>
        </div>

        {/* 4 Real Stat Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          
          <div className="glass-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              <span>উত্তোলনযোগ্য ওয়ালেট ব্যালেন্স</span>
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Wallet className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              ৳{balance.toFixed(2)}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">বিকাশ পার্সোনালে উত্তোলনযোগ্য</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              <span>মোট অর্জিত ইনকাম</span>
              <span className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              ৳{lifetimeEarnings.toFixed(2)}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              প্রকৃত সম্পন্ন লেনদেন অনুযায়ী
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              <span>সফল রিসেল অর্ডার</span>
              <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <ShoppingBag className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {completedOrdersCount} টি
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              ডেলিভার্ড এস্ক্রো অর্ডার
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              <span>সম্পন্ন মাইক্রো-টাস্ক</span>
              <span className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                <Briefcase className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {completedJobsCount} টি
            </div>
            <div className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 font-medium">
              অনুমোদিত কাজের সংখ্যা
            </div>
          </div>

        </div>

        {/* Transactions & Earnings History Table */}
        <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-md">
          
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                লেনদেন ও আয়ের সাম্প্রতিক ইতিহাস
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">সর্বশেষ জমা হওয়া কমিশন, কয়েন কনভার্ট ও উত্তোলনের বিবরণী</p>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'সব' },
                { id: 'commission', label: 'কমিশন' },
                { id: 'job', label: 'মাইক্রো-জব' },
                { id: 'quiz', label: 'কয়েন কনভার্ট' },
                { id: 'withdraw', label: 'উত্তোলন' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { playSound('click'); setFilterType(f.id); }}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    filterType === f.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
                কোনো লেনদেনের রেকর্ড পাওয়া যায়নি
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const isWithdrawal = tx.type === 'withdrawal';

                return (
                  <div key={tx.id} className="p-3.5 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors min-w-0">
                    
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isWithdrawal 
                          ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' 
                          : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isWithdrawal ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                          {tx.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                          <span>{tx.date}</span>
                          {tx.trxId && <span className="font-mono break-all">· TrxID: {tx.trxId}</span>}
                          {tx.account && <span className="break-all">· {tx.account}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`font-black text-base sm:text-lg font-mono tabular-nums flex items-center justify-end gap-0.5 ${
                        isWithdrawal 
                          ? 'text-rose-600 dark:text-rose-400' 
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        <span>{isWithdrawal ? '-৳' : '+৳'}</span>
                        <span>{tx.amount.toFixed(2)}</span>
                      </div>
                      
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {tx.status === 'pending' ? 'পেন্ডিং' : 'সম্পন্ন'}
                      </span>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>
    </section>
  );
};
