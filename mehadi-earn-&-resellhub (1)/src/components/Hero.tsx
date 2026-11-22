import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle, 
  Zap, 
  ShieldCheck, 
  DollarSign, 
  Lock, 
  PlusCircle, 
  ShoppingBag, 
  Briefcase, 
  HelpCircle, 
  Calculator, 
  MessageSquare, 
  Sparkles, 
  Coins, 
  RefreshCw, 
  User,
  Users,
  Copy,
  Check,
  Share2,
  Gift,
  TrendingUp,
  Award,
  History,
  X,
  ExternalLink
} from 'lucide-react';
import { playSound } from '../utils/audio';
import { Language, AppTab, UserAccount, Transaction } from '../types';
import { GiftCodeModal } from './GiftCodeModal';
import { TaskHistoryModal } from './TaskHistoryModal';

interface HeroProps {
  coins: number;
  balance: number;
  onConvertCoins: () => void;
  onStartEarning: () => void;
  onOpenCreateJob: () => void;
  onOpenRules: () => void;
  onSelectTab: (tab: AppTab) => void;
  onOpenMathTask: () => void;
  onOpenQuizJob: () => void;
  onOpenCaptcha: () => void;
  onOpenWallet?: () => void;
  onOpenSpinWin?: () => void;
  language: Language;
  currentUser?: UserAccount | null;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
  onShowToast?: (msg: string) => void;
  transactions?: Transaction[];
  onClaimGiftReward?: (rewardType: 'coins' | 'balance', amount: number, code: string) => void;
}

export const Hero: React.FC<HeroProps> = ({
  coins,
  balance,
  onConvertCoins,
  onStartEarning,
  onOpenCreateJob,
  onOpenRules,
  onSelectTab,
  onOpenMathTask,
  onOpenQuizJob,
  onOpenCaptcha,
  onOpenWallet,
  onOpenSpinWin,
  language,
  currentUser = null,
  onOpenLogin,
  onOpenRegister,
  onShowToast,
  transactions = [],
  onClaimGiftReward
}) => {
  const isBn = language === 'bn';
  const canConvert = coins >= 1000;
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Generate unique personal referral link for logged in user
  const referralCode = currentUser?.referralCode || currentUser?.id || '';
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(referralCode)}`
    : `https://microearnbd.com/?ref=${referralCode}`;

  const handleCopyReferralLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        const input = document.createElement('input');
        input.value = referralLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedReferral(true);
      playSound('success');
      if (onShowToast) {
        onShowToast(isBn ? 'রেফারেল লিংক কপি হয়েছে! বন্ধুদের শেয়ার করুন।' : 'Referral link copied! Share with friends.');
      }
      setTimeout(() => setCopiedReferral(false), 3000);
    } catch {
      if (onShowToast) onShowToast(isBn ? 'লিংক কপি করা যায়নি।' : 'Failed to copy link.');
    }
  };

  // =========================================================================
  // VIEW 1: CLEAN, PROFESSIONAL PUBLIC LANDING PAGE (FOR UNAUTHENTICATED VISITORS)
  // NO dashboard features (No Spin, Wallet, Surveys, Math Quiz, Captcha, Micro-jobs, Coin Wallet)
  // =========================================================================
  if (!currentUser) {
    return (
      <div id="landing-page" className="relative py-8 sm:py-14 overflow-hidden">
        {/* Soft background ambient glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[720px] h-[400px] bg-gradient-to-tr from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
          
          {/* Hero Section */}
          <section className="text-center max-w-4xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold uppercase tracking-wider shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isBn ? 'MicroEarn BD • বিশ্বস্ত এস্ক্রো আর্নিং ও রিসেলিং প্ল্যাটফর্ম' : 'MicroEarn BD • Trusted Escrow Tasks & Reselling'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 dark:text-white leading-[1.2] tracking-tight">
              {isBn ? (
                <>
                  <span>ঘরে বসে </span>
                  <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                    বিনা ইনভেস্টমেন্টে রিসেলিং
                  </span>
                  <span> করুন, বিশ্বস্ত মাইক্রো-টাস্কে নিশ্চিত আয়!</span>
                </>
              ) : (
                <>
                  <span>Start </span>
                  <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                    Zero Investment Reselling
                  </span>
                  <span> & Micro Tasks in Bangladesh</span>
                </>
              )}
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {isBn 
                ? 'অনলাইন পাইকারি পণ্য কোনো ইনভেস্ট ছাড়াই বিক্রি করে নিশ্চিত লাভ করুন। সহজ জ্ঞানচর্চা ও মাইক্রো-টাস্ক সম্পন্ন করে সরাসরি পার্সোনাল বিকাশ ও নগদে ক্যাশআউট নিন।'
                : 'Resell wholesale products without investment, complete verified micro-tasks, and withdraw instantly to your personal bKash account.'}
            </p>

            {/* High-Impact Primary CTA Buttons: Login & Register */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  if (onOpenLogin) onOpenLogin();
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <User className="w-4 h-4 text-emerald-500" />
                <span>{isBn ? 'লগইন করুন (Sign In)' : 'Sign In'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  if (onOpenRegister) onOpenRegister();
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isBn ? 'বিনামূল্যে রেজিস্ট্রেশন করুন (Get Started Free)' : 'Create Free Account'}</span>
              </button>
            </div>

            {/* Trust Markers */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {isBn ? '১০০% ফ্রি রেজিস্ট্রেশন' : '100% Free Registration'}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {isBn ? 'বিকাশ পার্সোনালে ০% ফি' : '0% bKash Cashout Fee'}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {isBn ? 'গুগল ফায়ারবেস ক্লাউড নিরাপত্তা' : 'Firebase Cloud Security'}
              </span>
            </div>
          </section>

          {/* Platform Services & Features Showcase (Informational Overview) */}
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {isBn ? 'কেন MicroEarn BD তে যুক্ত হবেন?' : 'Why Choose MicroEarn BD?'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isBn 
                  ? 'একটিমাত্র প্ল্যাটফর্মে একাধিক নির্ভরযোগ্য ও বৈধ আয়ের মাধ্যম' 
                  : 'Multiple verified and reliable earning avenues in one single platform'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Feature 1: Reselling */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 hover:border-emerald-500/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl shadow-sm">
                  🛍️
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {isBn ? 'বিনা ইনভেস্টমেন্টে রিসেলিং' : 'Zero Investment Reselling'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {isBn 
                      ? 'পাইকারি মূল্যের হাজারো পণ্য থেকে পছন্দ করে ফেসবুক ও সোশ্যাল মিডিয়ায় বিক্রি করুন। গ্রাহকের ডেলিভারি সম্পন্ন হলেই কমিশন চলে আসবে আপনার ওয়ালেটে।' 
                      : 'Pick from wholesale inventory and sell to customers. Get automatic commission directly upon courier delivery.'}
                  </p>
                </div>
              </div>

              {/* Feature 2: Tasks & Quizzes */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 hover:border-teal-500/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-xl shadow-sm">
                  ➕
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {isBn ? 'সহজ ম্যাথ ও নলেজ টাস্ক' : 'Simple Math & Quiz Tasks'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {isBn 
                      ? 'সহজ যোগ অংক ও সাধারণ জ্ঞান কুইজ সমাধান করে কয়েন আয় করুন। প্রতি ১,০০০ কয়েন তাৎক্ষণিকভাবে ৳১.০০ মূল নগদ ব্যালেন্সে রূপান্তরযোগ্য।' 
                      : 'Solve simple addition and general knowledge quizzes to earn coins. Convert 1,000 coins instantly into ৳1.00 BDT cash.'}
                  </p>
                </div>
              </div>

              {/* Feature 3: Micro-Jobs */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 hover:border-cyan-500/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-black text-xl shadow-sm">
                  💼
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {isBn ? 'সোশ্যাল মাইক্রো-জব ও টাস্ক' : 'Verified Social Micro Jobs'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {isBn 
                      ? 'ইউটিউব সাবস্ক্রাইব, ফেসবুক ফলো, অ্যাপ ইনস্টল ও রিভিউয়ের মতো সহজ কাজ সম্পন্ন করে স্ক্রিনশট প্রুফ জমা দিয়ে নিশ্চিত ইনকাম করুন।' 
                      : 'Complete micro jobs like YouTube, Facebook, and App reviews to earn steady daily rewards with proof verification.'}
                  </p>
                </div>
              </div>

              {/* Feature 4: Referral System */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 hover:border-amber-500/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xl shadow-sm">
                  👥
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {isBn ? 'ইউজার রেফারেল প্রোগ্রাম' : 'Lifetime Referral Program'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {isBn 
                      ? 'আপনার ব্যক্তিগত রেফারেল লিংক দিয়ে বন্ধুদের আমন্ত্রণ জানান। প্রতিটি সফল জয়েনিং ও তাদের সম্পন্ন কাজের ওপর লাইফটাইম রেফারেল বোনাস উপভোগ করুন।' 
                      : 'Invite friends with your unique personal link. Earn referral bonuses and commission whenever your network completes tasks.'}
                  </p>
                </div>
              </div>

              {/* Feature 5: Instant Cashout */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 hover:border-pink-500/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400 flex items-center justify-center font-black text-xl shadow-sm">
                  ⚡
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {isBn ? 'ইনস্ট্যান্ট বিকাশ ক্যাশআউট' : 'Instant bKash Cashout'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {isBn 
                      ? 'কোনো জটিলতা ছাড়াই নূন্যতম ৳১০০ হলেই সরাসরি আপনার ব্যক্তিগত বিকাশ পার্সোনাল নম্বরে ক্যাশআউট রিকোয়েস্ট করুন। ০% হিডেন চার্জ।' 
                      : 'Withdraw your verified earnings directly to your bKash personal account starting from just ৳100 with zero deduction fees.'}
                  </p>
                </div>
              </div>

              {/* Feature 6: Escrow Security */}
              <div className="glass-card p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3 hover:border-indigo-500/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl shadow-sm">
                  🛡️
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {isBn ? 'Firebase এস্ক্রো নিরাপত্তা' : 'Firebase Cloud Escrow'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {isBn 
                      ? 'আপনার কষ্টার্জিত প্রতিটি টাকা এবং গ্রাহকের অর্ডার ক্লাউড ডাটাবেজে এস্ক্রো সুরক্ষায় থাকে। ভেরিফাইড পেমেন্ট নিশ্চিত না হওয়া পর্যন্ত অর্থ নিরাপদ।' 
                      : 'Every balance and reselling order is secured by real-time cloud escrow logic, safeguarding user and customer funds.'}
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* How It Works (3 Steps) */}
          <section className="p-6 sm:p-10 rounded-3xl bg-slate-900 text-white space-y-8">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 uppercase tracking-wider">
                {isBn ? 'সহজ ৩টি ধাপ' : '3 Simple Steps'}
              </span>
              <h2 className="text-xl sm:text-3xl font-black">
                {isBn ? 'কীভাবে আয় শুরু করবেন?' : 'How Does It Work?'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white font-black text-sm flex items-center justify-center">
                  ১
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {isBn ? 'ফ্রি একাউন্ট তৈরি করুন' : '1. Create Free Account'}
                </h3>
                <p className="text-xs text-slate-300">
                  {isBn 
                    ? 'আপনার মোবাইল নম্বর বা জিমেইল দিয়ে মাত্র ৩০ সেকেন্ডে নিরাপদ অ্যাকাউন্ট খুলুন।' 
                    : 'Sign up in 30 seconds using Google or your Bangladeshi mobile number.'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500 text-white font-black text-sm flex items-center justify-center">
                  ২
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {isBn ? 'কাজ বা রিসেলিং শুরু করুন' : '2. Start Tasks or Resell'}
                </h3>
                <p className="text-xs text-slate-300">
                  {isBn 
                    ? 'ড্যাশবোর্ডে লগইন করে ম্যাথ টাস্ক সমাধান করুন, পণ্য বিক্রি করুন অথবা বন্ধুদের রেফার করুন।' 
                    : 'Access your full dashboard to solve tasks, resell products, and invite friends.'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500 text-white font-black text-sm flex items-center justify-center">
                  ৩
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {isBn ? 'বিকাশে ক্যাশআউট নিন' : '3. Cashout via bKash'}
                </h3>
                <p className="text-xs text-slate-300">
                  {isBn 
                    ? 'আপনার অর্জিত ব্যালেন্স ০% সার্ভিস ফিতে বিকাশ পার্সোনালে সরাসরি উত্তোলন করুন।' 
                    : 'Withdraw your balance straight to your personal bKash number with zero deductions.'}
                </p>
              </div>
            </div>

            {/* Bottom Register Call to Action */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  if (onOpenRegister) onOpenRegister();
                  else if (onOpenLogin) onOpenLogin();
                }}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-xl shadow-emerald-500/30 cursor-pointer transition-all hover:scale-105"
              >
                {isBn ? 'আজই শুরু করুন — সম্পূর্ণ ফ্রি রেজিস্ট্রেশন →' : 'Get Started Now — Free Registration →'}
              </button>
            </div>
          </section>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED USER DASHBOARD
  // Visible ONLY when currentUser is logged in (auth.currentUser !== null)
  // Contains Coin Wallet, Spin & Win, and DEDICATED REFERRAL SYSTEM BOX
  // =========================================================================
  return (
    <section id="user-dashboard" className="relative pt-4 pb-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* User Welcome Greeting Banner */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-600/20 shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {isBn ? `স্বাগতম, ${currentUser.name}!` : `Welcome, ${currentUser.name}!`}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  {currentUser.memberTier || 'ভেরিফাইড মেম্বার'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn ? `যোগদান: ${currentUser.joinedDate} • সুরক্ষিত মেম্বার ড্যাশবোর্ড` : `Joined: ${currentUser.joinedDate}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { playSound('click'); onStartEarning(); }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity"
            >
              {isBn ? 'রিসেলিং শপ' : 'Shop'}
            </button>
            <button
              onClick={() => { playSound('click'); onOpenCreateJob(); }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              {isBn ? '+ কাজ পোস্ট' : '+ Post Job'}
            </button>
          </div>
        </div>


        {/* Dashboard Service & Task Cards Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>{isBn ? 'আর্নিং টাস্ক ও ড্যাশবোর্ড সার্ভিসসমূহ' : 'Earning Tasks & Services'}</span>
            </h2>
            <span className="text-[10px] font-bold text-slate-400">
              {isBn ? 'টাস্কে ক্লিক করে শুরু করুন' : 'Click any to begin'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
            
            {/* 1. Math Task (50,000+ Addition) */}
            <div
              onClick={() => { playSound('click'); onOpenMathTask(); }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-500 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-110 transition-transform mb-3">
                  <Calculator className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'ম্যাথ টাস্ক' : 'Math Task'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? '৫০,০০০+ সহজ যোগ (+) অংকে +৫০ কয়েন' : '50,000+ addition (+) problems'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-teal-600 dark:text-teal-400">
                <span>{isBn ? 'অংক করুন' : 'Start Math'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 2. Quiz Job */}
            <div
              onClick={() => { playSound('click'); onOpenQuizJob(); }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-amber-500 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-110 transition-transform mb-3">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'কুইজ জব' : 'Quiz Job'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? 'লাইভ ডায়নামিক কুইজ প্রশ্নে +৫০ কয়েন' : 'Dynamic API quiz questions'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span>{isBn ? 'কুইজ খেলুন' : 'Play Quiz'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 3. Captcha Solving */}
            <div
              onClick={() => { playSound('click'); onOpenCaptcha(); }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-110 transition-transform mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'ক্যাপচা সলভিং' : 'Captcha Solving'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? '৫০,০০০+ বাটন ক্যাপচায় +৫০ কয়েন' : '50,000+ button captchas'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                <span>{isBn ? 'ক্যাপচা করুন' : 'Solve'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 4. Micro-Jobs */}
            <div
              onClick={() => { playSound('click'); onSelectTab('microjobs'); }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/60 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:scale-110 transition-transform mb-3">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'মাইক্রো-জব' : 'Micro Jobs'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? 'ইউটিউব, ফেসবুক ও অ্যাপ টাস্ক' : 'Daily small tasks & jobs'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                <span>{isBn ? 'কাজ দেখুন' : 'View Jobs'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 5. Reselling Hub */}
            <div
              onClick={() => { playSound('click'); onSelectTab('resell'); }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform mb-3">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'রিসেলিং হাব' : 'Resell Hub'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? 'বিনা ইনভেস্টমেন্টে পাইকারি পণ্য বিক্রি' : 'Zero investment wholesale items'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span>{isBn ? 'স্টোর দেখুন' : 'Browse'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 6. Spin & Win (বা স্পিন এবং উইন) */}
            <div
              onClick={() => { 
                playSound('click'); 
                if (onOpenSpinWin) onOpenSpinWin();
              }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-purple-300 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/20 hover:border-purple-500 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-purple-950 dark:text-purple-200 leading-tight">
                  {isBn ? 'স্পিন & উইন' : 'Spin & Win'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? 'খরচ ৳১০, জিতুন ৳৫-৳২০ নিশ্চিত প্রাইজ' : 'Cost ৳10, win ৳5-৳20'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-purple-100 dark:border-purple-900/60 flex items-center justify-between text-[11px] font-bold text-purple-600 dark:text-purple-400">
                <span>{isBn ? 'স্পিন খেলুন' : 'Spin Now'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 7. DEDICATED REFERRAL LINK BUTTON (CLICKABLE REVEAL) */}
            <div
              onClick={() => {
                playSound('click');
                setShowReferralModal(true);
              }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border-2 border-amber-400/80 dark:border-amber-500/60 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 hover:shadow-xl hover:border-amber-500 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/30 group-hover:scale-110 transition-transform mb-3">
                  <Gift className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                    {isBn ? 'রেফারেল লিংক' : 'Referral Link'}
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black">
                    বোনাস
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn 
                    ? `সফল রেফারেল: ${currentUser.referralsCount || 0} জন • ক্লিক করে লিংক দেখুন`
                    : `Total Referred: ${currentUser.referralsCount || 0} Members • Click to reveal`}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span>{isBn ? 'লিংক দেখুন ও শেয়ার করুন' : 'Reveal Link'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 8. Wallet & Cashout */}
            <div
              onClick={() => { 
                playSound('click'); 
                if (onOpenWallet) { onOpenWallet(); } else { onSelectTab('analytics'); }
              }}
              className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-pink-500/60 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-pink-500/20 group-hover:scale-110 transition-transform mb-3">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                  {isBn ? 'ওয়ালেট ও ক্যাশআউট' : 'Wallet & Cashout'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {isBn ? 'পাসওয়ার্ড সুরক্ষিত বিকাশ পেআউট' : 'Password protected bKash payout'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-pink-600 dark:text-pink-400">
                <span>{isBn ? 'উত্তোলন' : 'Withdraw'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

          </div>

          {/* DEDICATED BUTTONS: GIFT CODE & TASK HISTORY (PLACED RIGHT ABOVE COMPLAINTS) */}
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Button A: Gift Code */}
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setShowGiftModal(true);
              }}
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400/60 hover:border-amber-500 text-left transition-all cursor-pointer group flex items-center justify-between shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                      {isBn ? 'গিফট কোড (Gift Code)' : 'Gift Code'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-slate-950">
                      ফ্রি রিওয়ার্ড
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isBn ? 'প্রমোশনাল গিফট কোড প্রবেশ করিয়ে বোনাস কয়েন ও ক্যাশ ক্লেইম করুন' : 'Enter promo codes to claim free bonus rewards'}
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shrink-0 shadow-sm">
                {isBn ? 'কোড দিন →' : 'Enter Code →'}
              </span>
            </button>

            {/* Button B: History */}
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setShowHistoryModal(true);
              }}
              className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border-2 border-emerald-400/60 hover:border-emerald-500 text-left transition-all cursor-pointer group flex items-center justify-between shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                      {isBn ? 'হিস্ট্রি (History & Earnings)' : 'Earnings History'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      বিবরণী
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isBn ? 'কোন কাজ থেকে কত আয় করেছেন তার রিয়েল-টাইম হিসেব দেখুন' : 'Detailed log of completed tasks and earnings'}
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0 shadow-sm">
                {isBn ? 'হিসেব দেখুন →' : 'View History →'}
              </span>
            </button>
          </div>

          {/* COMPLAINTS & SUGGESTIONS BOX (PLACED AT THE VERY BOTTOM) */}
          <div
            onClick={() => { playSound('click'); onSelectTab('support'); }}
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-cyan-500/10 border-2 border-blue-400/40 dark:border-blue-700/50 hover:border-blue-500 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                    {isBn ? 'মতামত ও অভিযোগ (Complaints & Suggestions)' : 'Support & Feedback Box'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    24/7 সাপোর্ট
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn ? 'উইথড্রয়াল সমস্যা, টাস্ক রিপোর্ট, একাউন্ট সহায়তা বা যেকোনো পরামর্শ সরাসরি এডমিনকে জানান' : 'Report issues, submit suggestions or request support directly to Admin'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 self-end sm:self-auto">
              <span>{isBn ? 'অভিযোগ বা মতামত জানান' : 'Open Support Box'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>

        {/* MODAL 1: REFERRAL LINK DISPLAY MODAL */}
        {showReferralModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-400/60 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {isBn ? 'আপনার ইউনিক রেফারেল লিংক' : 'Your Unique Referral Link'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isBn ? 'বন্ধুদের ইনভাইট করে আজীবন রেফারেল কমিশন উপভোগ করুন' : 'Invite friends and earn lifetime commission'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { playSound('click'); setShowReferralModal(false); }}
                  className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center cursor-pointer transition-all shadow-sm shrink-0"
                  aria-label="Close Referral Modal"
                  title="বন্ধ করুন (×)"
                >
                  &times;
                </button>
              </div>

              {/* Referral Details */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>রেফারেল কোড:</span>
                  <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-amber-300 dark:border-amber-700">
                    {referralCode}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">সম্পূর্ণ রেফারেল লিংক:</span>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl p-1.5">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="w-full bg-transparent text-xs font-mono text-slate-700 dark:text-slate-300 px-2 outline-none select-all truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyReferralLink}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        copiedReferral ? 'bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {copiedReferral ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>কপি হয়েছে!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>কপি লিংক</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>মোট সফল রেফারেল:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">{currentUser.referralsCount || 0} জন</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        )}

        {/* MODAL 2: GIFT CODE REDEMPTION MODAL */}
        <GiftCodeModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          onClaimReward={onClaimGiftReward || ((type, amount) => {
            playSound('success');
            if (onShowToast) {
              onShowToast(isBn ? `+${amount} রিওয়ার্ড ওয়ালেটে যোগ হয়েছে!` : `+${amount} reward credited!`);
            }
          })}
          currentUser={currentUser}
          onShowToast={onShowToast || (() => {})}
          language={language}
        />

        {/* MODAL 3: ACTIVITY & EARNINGS HISTORY MODAL */}
        <TaskHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          transactions={transactions}
          currentUser={currentUser}
          language={language}
        />

      </div>
    </section>
  );
};
