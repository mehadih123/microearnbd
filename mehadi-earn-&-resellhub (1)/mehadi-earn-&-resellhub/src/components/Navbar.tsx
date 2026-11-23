import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Bell, 
  Menu, 
  Globe, 
  ShieldCheck,
  User
} from 'lucide-react';
import { NotificationItem, UserAccount, Language, AppTab } from '../types';
import { playSound } from '../utils/audio';

interface NavbarProps {
  balance: number;
  coins: number;
  pendingEscrowBalance: number;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenMathTask: () => void;
  onOpenQuizJob: () => void;
  onOpenCaptcha: () => void;
  onOpenWallet: () => void;
  onOpenAuth: () => void;
  onOpenRegister?: () => void;
  onOpenSideDrawer: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  currentUser: UserAccount | null;
  language: Language;
  onToggleLanguage: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  balance,
  coins,
  pendingEscrowBalance,
  activeTab,
  onSelectTab,
  onOpenMathTask,
  onOpenQuizJob,
  onOpenCaptcha,
  onOpenWallet,
  onOpenAuth,
  onOpenRegister,
  onOpenSideDrawer,
  notifications,
  onMarkNotificationsRead,
  currentUser,
  language,
  onToggleLanguage
}) => {
  const isBn = language === 'bn';
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleTabClick = (tab: AppTab) => {
    playSound('click');
    if (!currentUser && tab !== 'home' && tab !== 'support') {
      onOpenAuth();
      return;
    }
    onSelectTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 w-full glass-nav pt-[env(safe-area-inset-top,0px)] transition-colors duration-300">
      <div className="w-full px-3">
        <div className="flex items-center justify-between min-h-[60px] py-2 gap-1.5 min-w-0">
          
          {/* Brand Logo ("MicroEarn BD") */}
          <div 
            className="flex items-center gap-2 cursor-pointer select-none min-w-0 shrink" 
            onClick={() => handleTabClick('home')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm min-[380px]:text-base font-black tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent truncate">
                MicroEarn BD
              </span>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1 shrink-0">
            
            {/* Language Toggle */}
            <button
              onClick={onToggleLanguage}
              className="min-h-[38px] px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{isBn ? 'EN' : 'বাং'}</span>
            </button>

            {/* Notifications Button */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  playSound('click');
                  setNotifDropdownOpen(!notifDropdownOpen);
                  if (!notifDropdownOpen) onMarkNotificationsRead();
                }}
                className="relative w-9 h-9 rounded-xl text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-600 rounded-full" />
                )}
              </button>

              {notifDropdownOpen && (
                <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] mx-auto max-w-[436px] glass-card rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-3.5 px-4 z-[60] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        নোটিফিকেশন
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        সর্বশেষ আপডেট
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { playSound('click'); setNotifDropdownOpen(false); }}
                      className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border border-rose-200 dark:border-slate-700 font-black text-lg leading-none flex items-center justify-center transition-all cursor-pointer shrink-0"
                      aria-label="নোটিফিকেশন বন্ধ করুন"
                      title="বন্ধ করুন (×)"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 mt-1">
                    {notifications.map((n) => (
                      <div key={n.id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {n.title}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Balance & Cashout Box */}
            {currentUser && (
              <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-sm shrink-0">
                <div className="px-1">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-tight whitespace-nowrap font-mono tabular-nums">
                    ৳{balance.toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => {
                    playSound('click');
                    onOpenWallet();
                  }}
                  className="px-2 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-0.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>ক্যাশআউট</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {!currentUser && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { playSound('click'); onOpenAuth(); }}
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{isBn ? 'লগইন' : 'Login'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { playSound('click'); if (onOpenRegister) onOpenRegister(); else onOpenAuth(); }}
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span>{isBn ? 'রেজিস্টার' : 'Sign Up'}</span>
                </button>
              </div>
            )}

            {/* 3-Line Hamburger Menu Icon */}
            <button
              onClick={() => {
                playSound('click');
                onOpenSideDrawer();
              }}
              className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 flex items-center justify-center transition-colors cursor-pointer border border-emerald-200 dark:border-slate-700 shadow-sm active:scale-95"
              aria-label="Open Navigation Drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
