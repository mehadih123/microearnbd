import React from 'react';
import { 
  Home, 
  Wallet, 
  Calculator,
  HelpCircle,
  ShieldCheck,
  User
} from 'lucide-react';
import { AppTab, Language, UserAccount } from '../types';
import { playSound } from '../utils/audio';

interface BottomNavBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenMathTask: () => void;
  onOpenQuizJob: () => void;
  onOpenCaptcha: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  language: Language;
  currentUser?: UserAccount | null;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenMathTask,
  onOpenQuizJob,
  onOpenCaptcha,
  onOpenWallet,
  onOpenProfile,
  language,
  currentUser = null
}) => {
  const isBn = language === 'bn';

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 mx-auto z-50 w-full max-w-[460px] overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-x-0 sm:border-x border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-1.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] transition-colors duration-300"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around w-full gap-0.5 min-w-0">
        
        {/* 1. Home Tab */}
        <button
          onClick={() => {
            playSound('click');
            onSelectTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'home'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/70 dark:bg-emerald-950/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[10px] min-[390px]:text-[11px] font-bold mt-0.5 truncate max-w-full tracking-tight">
            {isBn ? 'হোম' : 'Home'}
          </span>
        </button>

        {/* 2. Separate Math Task Button */}
        <button
          onClick={() => {
            playSound('click');
            if (!currentUser) onOpenProfile();
            else onOpenMathTask();
          }}
          className="flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-teal-600 dark:text-teal-400 font-bold hover:bg-teal-50/60 dark:hover:bg-teal-950/30 transition-all cursor-pointer"
        >
          <Calculator className="w-5 h-5 shrink-0" />
          <span className="text-[10px] min-[390px]:text-[11px] font-bold mt-0.5 truncate max-w-full tracking-tight">
            {isBn ? 'ম্যাথ' : 'Math'}
          </span>
        </button>

        {/* 3. Separate Quiz Job Button */}
        <button
          onClick={() => {
            playSound('click');
            if (!currentUser) onOpenProfile();
            else onOpenQuizJob();
          }}
          className="flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-all cursor-pointer"
        >
          <HelpCircle className="w-5 h-5 shrink-0" />
          <span className="text-[10px] min-[390px]:text-[11px] font-bold mt-0.5 truncate max-w-full tracking-tight">
            {isBn ? 'কুইজ' : 'Quiz'}
          </span>
        </button>

        {/* 4. Separate Captcha Solving Button */}
        <button
          onClick={() => {
            playSound('click');
            if (!currentUser) onOpenProfile();
            else onOpenCaptcha();
          }}
          className="flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-all cursor-pointer"
        >
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span className="text-[10px] min-[390px]:text-[11px] font-bold mt-0.5 truncate max-w-full tracking-tight">
            {isBn ? 'ক্যাপচা' : 'Captcha'}
          </span>
        </button>

        {/* 5. Wallet & Cashout Tab */}
        <button
          onClick={() => {
            playSound('click');
            if (!currentUser) onOpenProfile();
            else onOpenWallet();
          }}
          className="flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-pink-600 dark:text-pink-400 font-bold hover:bg-pink-50/60 dark:hover:bg-pink-950/30 transition-all cursor-pointer"
        >
          <Wallet className="w-5 h-5 shrink-0" />
          <span className="text-[10px] min-[390px]:text-[11px] font-bold mt-0.5 truncate max-w-full tracking-tight">
            {isBn ? 'ওয়ালেট' : 'Wallet'}
          </span>
        </button>

        {/* 6. Profile Tab */}
        <button
          onClick={() => {
            playSound('click');
            onOpenProfile();
          }}
          className="flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="text-[10px] min-[390px]:text-[11px] font-bold mt-0.5 truncate max-w-full tracking-tight">
            {isBn ? 'প্রোফাইল' : 'Profile'}
          </span>
        </button>

      </div>
    </nav>
  );
};
