import React, { useState } from 'react';
import { 
  X, 
  User, 
  Wallet, 
  Briefcase, 
  PlusCircle, 
  ShoppingBag, 
  HelpCircle, 
  Calculator,
  FileText, 
  MessageSquare, 
  LogOut, 
  LogIn,
  ShieldCheck, 
  Moon, 
  Sun, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  Sparkles,
  BarChart3,
  Home,
  Coins,
  RefreshCw,
  Mail,
  Lock,
  Trash2,
  AlertTriangle,
  KeyRound
} from 'lucide-react';
import { UserAccount, Language, AppTab } from '../types';
import { PolicyPageType } from './PolicyTrustModal';
import { playSound } from '../utils/audio';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  balance: number;
  coins: number;
  pendingEscrowBalance: number;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenMathTask: () => void;
  onOpenQuizJob: () => void;
  onOpenCaptcha: () => void;
  onConvertCoins: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenCreateJob: () => void;
  onOpenRules: () => void;
  onOpenPolicyPage: (page: PolicyPageType) => void;
  onOpenSpinWin?: () => void;
  onLogout: () => void;
  onDeleteAccount?: (password?: string) => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  language: Language;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  balance,
  coins,
  pendingEscrowBalance,
  activeTab,
  onSelectTab,
  onOpenMathTask,
  onOpenQuizJob,
  onOpenCaptcha,
  onConvertCoins,
  onOpenWallet,
  onOpenProfile,
  onOpenAuth,
  onOpenCreateJob,
  onOpenRules,
  onOpenPolicyPage,
  onOpenSpinWin,
  onLogout,
  onDeleteAccount,
  darkMode,
  toggleDarkMode,
  isMuted,
  toggleMute,
  language
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const isBn = language === 'bn';

  const handleNavTab = (tab: AppTab) => {
    playSound('click');
    onSelectTab(tab);
    onClose();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword.trim()) {
      setDeleteError(isBn ? 'অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন!' : 'Please enter your password!');
      playSound('error');
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (onDeleteAccount) {
        await onDeleteAccount(deletePassword.trim());
      }
      setShowDeleteModal(false);
      onClose();
    } catch (err: unknown) {
      setDeleteError((err as Error)?.message || (isBn ? 'অ্যাকাউন্ট ডিলিট করা যায়নি।' : 'Failed to delete account.'));
      playSound('error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Centered Mobile-Frame Drawer Container */}
      <div className="relative mx-auto w-full max-w-[460px] h-full pointer-events-none">
        {/* Drawer Panel */}
        <div className="pointer-events-auto absolute inset-y-0 right-0 max-w-[360px] w-[88%] pt-[env(safe-area-inset-top,0px)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl border-l border-slate-200/80 dark:border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Top Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 text-white flex items-center justify-center font-black shadow-md shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  MicroEarn BD
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isBn ? 'মেনু ও দ্রুত ন্যাভিগেশন' : 'Navigation & Settings'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { playSound('click'); onClose(); }}
              className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
              aria-label="Close Drawer"
              title="বন্ধ করুন (×)"
            >
              &times;
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          
          {/* User Mini Profile & Coin Wallet Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-white font-bold text-base flex items-center justify-center shadow-md">
                {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'ME'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {currentUser?.name || (isBn ? 'লগইন করা নেই' : 'Guest Session')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {currentUser?.phone || (isBn ? 'অ্যাকাউন্টে লগইন করুন' : 'Sign in to your account')}
                </div>
              </div>
            </div>

            {/* Balances Display */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isBn ? 'উত্তোলনযোগ্য' : 'Withdrawable'}</div>
                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono tabular-nums">
                  ৳{balance.toFixed(2)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isBn ? 'পেন্ডিং এস্ক্রো' : 'Escrow'}</div>
                <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                  ৳{pendingEscrowBalance.toLocaleString('bn-BD')}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isBn ? 'কয়েন' : 'Coins'}</div>
                <div className="text-xs sm:text-sm font-black text-amber-500 mt-0.5 font-mono tabular-nums">
                  {coins.toLocaleString('bn-BD')}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { playSound('click'); onClose(); onOpenWallet(); }}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>{isBn ? 'টাকা তুলুন' : 'Withdraw'}</span>
              </button>
              {!currentUser && (
                <button
                  onClick={() => { playSound('click'); onClose(); onOpenAuth(); }}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isBn ? 'লগইন / সাইনআপ' : 'Sign In'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs Links — Strictly Separate Math Task & Quiz Job */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 px-3 mb-1">
              {isBn ? 'সেকশন ও আর্নিং টাস্কসমূহ' : 'Sections & Tasks'}
            </div>

            <button
              onClick={() => handleNavTab('home')}
              className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-semibold ${
                activeTab === 'home'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4 text-emerald-500" />
                <span>{isBn ? 'হোমপেজ' : 'Homepage'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* SEPARATE NAV BUTTON 1: MATH TASK */}
            <button
              onClick={() => {
                playSound('click');
                onClose();
                onOpenMathTask();
              }}
              className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-bold hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-300"
            >
              <div className="flex items-center gap-3">
                <Calculator className="w-4 h-4 text-teal-500" />
                <span>{isBn ? 'ম্যাথ টাস্ক (সহজ যোগ +৫০ কয়েন)' : 'Math Task (+50 Coins)'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* SEPARATE NAV BUTTON 2: QUIZ JOB */}
            <button
              onClick={() => {
                playSound('click');
                onClose();
                onOpenQuizJob();
              }}
              className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-bold hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>{isBn ? 'কুইজ জব (সাধারণ জ্ঞান +৫০ কয়েন)' : 'Quiz Job (+50 Coins)'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* SEPARATE NAV BUTTON 3: CAPTCHA SOLVING */}
            <button
              onClick={() => {
                playSound('click');
                onClose();
                onOpenCaptcha();
              }}
              className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>{isBn ? 'ক্যাপচা সলভিং (+৫০ কয়েন)' : 'Captcha Solving (+50 Coins)'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => handleNavTab('resell')}
              className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-semibold ${
                activeTab === 'resell'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4 text-cyan-500" />
                <span>{isBn ? 'রিসেলিং স্টোর (পণ্য ও কমিশন)' : 'Reselling Store'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => handleNavTab('microjobs')}
              className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-semibold ${
                activeTab === 'microjobs'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <span>{isBn ? 'মাইক্রো-জব তালিকা' : 'Micro Jobs List'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Spin & Win Dedicated Wheel Link */}
            <button
              onClick={() => {
                playSound('click');
                onClose();
                if (onOpenSpinWin) onOpenSpinWin();
              }}
              className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/60 text-purple-600 dark:text-purple-400"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>{isBn ? 'স্পিন & উইন হুইল (৳১০ এ ৳৫-৳২০)' : 'Spin & Win Wheel'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => handleNavTab('analytics')}
              className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-semibold ${
                activeTab === 'analytics'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span>{isBn ? 'ড্যাশবোর্ড ও লেনদেন' : 'Analytics & Wallet'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => handleNavTab('support')}
              className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer text-sm font-semibold ${
                activeTab === 'support'
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 font-bold border border-teal-200/60 dark:border-teal-800/60'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <span>{isBn ? 'মতামত বা অভিযোগ বক্স' : 'Feedback & Complaints'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Quick Actions & Extras */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { playSound('click'); onClose(); onOpenCreateJob(); }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{isBn ? 'কাজ পোস্ট করুন (Create a Job)' : 'Post a Micro Job'}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-normal">
                {isBn ? 'পাবলিক' : 'Public'}
              </span>
            </button>

            <button
              onClick={() => { playSound('click'); onClose(); onOpenProfile(); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-emerald-500" />
                <span>{isBn ? 'প্রোফাইল বিবরণী' : 'Profile Details'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => { playSound('click'); onClose(); onOpenRules(); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>{isBn ? 'এস্ক্রো নিয়মাবলী' : 'Escrow Rules'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Individual Unpacked Menu Options: Contact Us, Privacy Policy, Support/Help, Rules, Terms */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">
              {isBn ? 'সহায়তা ও নীতিমালা' : 'Support & Legal Options'}
            </div>

            <button
              onClick={() => { playSound('click'); onClose(); onOpenPolicyPage('contact'); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'যোগাযোগ করুন (Contact Us)' : 'Contact Us'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => { playSound('click'); onClose(); onOpenPolicyPage('privacy'); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isBn ? 'গোপনীয়তা নীতি (Privacy Policy)' : 'Privacy Policy'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => { playSound('click'); onClose(); onSelectTab('support'); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{isBn ? 'সহায়তা ও সাপোর্ট (Support & Help)' : 'Support & Help'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => { playSound('click'); onClose(); onOpenRules(); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>{isBn ? 'নিয়মাবলী ও নির্দেশিকা (Rules & Guide)' : 'Rules & Guidelines'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => { playSound('click'); onClose(); onOpenPolicyPage('terms'); }}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{isBn ? 'শর্তাবলী (Terms & Conditions)' : 'Terms & Conditions'}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

        </div>

        {/* Bottom Drawer Footer (Moon/Sun and Volume icons completely removed) */}
        <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/90 space-y-2 relative z-10 shrink-0">
          <div className="text-center pb-1">
            <span className="text-[10px] text-slate-400 font-mono">MicroEarn BD • 100% Secure</span>
          </div>

          {currentUser ? (
            <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
              {/* Logout Button */}
              <button
                type="button"
                onClick={() => { playSound('click'); onClose(); onLogout(); }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 hover:text-white dark:text-slate-200 bg-slate-100 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>{isBn ? 'লগআউট (Sign Out)' : 'Sign Out'}</span>
              </button>

              {/* Prominent Delete Account Button Right Below Logout */}
              <button
                type="button"
                onClick={() => {
                  playSound('error');
                  setShowDeleteModal(true);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 border border-rose-300 dark:border-rose-800/80 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBn ? 'একাউন্ট ডিলিট করুন (Delete Account)' : 'Delete Account'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { onClose(); onOpenAuth(); }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>{isBn ? 'লগইন / রেজিস্ট্রেশন' : 'Sign In'}</span>
            </button>
          )}
        </div>

        {/* DELETE ACCOUNT CONFIRMATION MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="relative my-auto w-full max-w-[380px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-500 p-6 space-y-4">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => { playSound('click'); setShowDeleteModal(false); }}
                className="absolute top-3.5 right-3.5 w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm"
                aria-label="Close Delete Account Modal"
                title={isBn ? 'বন্ধ করুন (×)' : 'Close (×)'}
              >
                &times;
              </button>
              <div className="text-center space-y-2 pt-2">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  {isBn ? 'অ্যাকাউন্ট স্থায়ীভাবে ডিলিট করবেন?' : 'Permanently Delete Account?'}
                </h4>
                <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                  {isBn
                    ? 'চূড়ান্ত সতর্কতা: অ্যাকাউন্ট মুছে ফেললে আপনার যাবতীয় ব্যালেন্স, কয়েন, রেফারেল হিস্ট্রি স্থায়ীভাবে ধ্বংস হয়ে যাবে এবং আর পুনরুদ্ধার করা যাবে না।'
                    : 'Warning: Deleting your account is permanent. All wallet balance, coins, and referrals will be destroyed.'}
                </p>
              </div>

              <form onSubmit={handleConfirmDelete} className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'নিশ্চিত করতে আপনার বর্তমান পাসওয়ার্ড/পিন লিখুন:' : 'Enter your password to confirm:'}
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value);
                      if (deleteError) setDeleteError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-base sm:text-sm font-mono text-slate-900 dark:text-white outline-none focus:border-rose-500"
                  />
                </div>

                {deleteError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-xs font-bold text-rose-600 dark:text-rose-300">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
                  >
                    {isDeleting ? (isBn ? 'ডিলিট হচ্ছে...' : 'Deleting...') : (isBn ? 'হ্যাঁ, স্থায়ীভাবে ডিলিট' : 'Yes, Delete')}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-300 cursor-pointer transition-colors"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
};
