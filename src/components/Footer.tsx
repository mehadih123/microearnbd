import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Heart, 
  Phone, 
  Mail, 
  ExternalLink,
  MessageSquare,
  Shield
} from 'lucide-react';
import { playSound } from '../utils/audio';
import { Language, AppTab } from '../types';
import { PolicyPageType } from './PolicyTrustModal';

interface FooterProps {
  onOpenWallet: () => void;
  onOpenRules: () => void;
  onOpenSupport: () => void;
  onOpenSecretAdmin: () => void;
  isAuthorizedAdmin?: boolean;
  onOpenPolicyPage: (page: PolicyPageType) => void;
  onOpenMathTask?: () => void;
  onOpenQuizJob?: () => void;
  onOpenCaptcha?: () => void;
  onSelectTab?: (tab: AppTab) => void;
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenWallet,
  onOpenRules,
  onOpenSupport,
  onOpenSecretAdmin,
  isAuthorizedAdmin = false,
  onOpenPolicyPage,
  onOpenMathTask,
  onOpenQuizJob,
  onOpenCaptcha,
  onSelectTab,
  language
}) => {
  const isBn = language === 'bn';
  const clickCountRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);

  // Secret 3-Click Rapid Trigger on Copyright Text (Strict Admin Gmail only)
  const handleSecretCopyrightClick = () => {
    if (!isAuthorizedAdmin) return;
    const now = Date.now();
    if (now - lastClickTimeRef.current < 800) {
      clickCountRef.current += 1;
      if (clickCountRef.current >= 3) {
        playSound('success');
        clickCountRef.current = 0;
        onOpenSecretAdmin();
      }
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;
  };

  const handleTab = (tab: AppTab) => {
    playSound('click');
    if (onSelectTab) {
      onSelectTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="glass-panel border-t border-slate-200/80 dark:border-slate-800 pt-10 pb-28 mt-8 transition-colors">
      <div className="w-full px-4">
        
        {/* Main Columns */}
        <div className="grid grid-cols-1 gap-7 pb-8 border-b border-slate-200 dark:border-slate-800">
          
          {/* Brand info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-xl font-black bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                MicroEarn BD
              </span>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {isBn 
                ? 'বাংলাদেশের সুরক্ষিত এস্ক্রো আর্নিং হাব। জিরো মূলধনে রিসেলিং, দ্রুত মাইক্রো-জব, ম্যাথ, কুইজ ও ক্যাপচা টাস্ক এবং নিরাপদ বিকাশ পার্সোনাল ক্যাশআউট।' 
                : 'Secure escrow earning platform. Zero capital reselling, verified micro jobs, and instant payouts.'}
            </p>

            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>১০০% নিরাপদ ও এনক্রিপ্টেড পেমেন্ট</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">
              {isBn ? 'প্রধান ক্যাটাগরি' : 'Quick Categories'}
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li>
                <button 
                  onClick={() => handleTab('resell')} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'রিসেলিং পণ্য শপ' : 'Resell Catalog'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTab('microjobs')} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'মাইক্রো-জব তালিকা' : 'Micro Jobs Board'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { playSound('click'); if (onOpenMathTask) onOpenMathTask(); }} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'ম্যাথ টাস্ক (+৫০ কয়েন)' : 'Math Task (+50 Coins)'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { playSound('click'); if (onOpenQuizJob) onOpenQuizJob(); }} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'কুইজ জব (+৫০ কয়েন)' : 'Quiz Job (+50 Coins)'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { playSound('click'); if (onOpenCaptcha) onOpenCaptcha(); }} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'ক্যাপচা সলভিং (+৫০ কয়েন)' : 'Captcha Solving (+50 Coins)'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTab('analytics')} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'আর্নিং ড্যাশবোর্ড' : 'Live Dashboard'}
                </button>
              </li>
            </ul>
          </div>

          {/* Dedicated Legal, Policy & Trust Pages (AdSense Compliance) */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">
              {isBn ? 'আইনি নীতিমালা ও সহায়তা' : 'Legal & Trust Center'}
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li>
                <button 
                  onClick={() => { playSound('click'); onOpenPolicyPage('privacy'); }} 
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer font-semibold"
                >
                  {isBn ? 'প্রাইভেসি পলিসি (Privacy Policy)' : 'Privacy Policy'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { playSound('click'); onOpenPolicyPage('terms'); }} 
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer font-semibold"
                >
                  {isBn ? 'শর্তাবলী (Terms & Conditions)' : 'Terms & Conditions'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { playSound('click'); onOpenPolicyPage('contact'); }} 
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer font-semibold"
                >
                  {isBn ? 'যোগাযোগ ও সহায়তা (Contact Us)' : 'Contact Us / Support'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { playSound('click'); onOpenRules(); }} 
                  className="hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  {isBn ? 'এস্ক্রো নিরাপত্তা শর্ত' : 'Smart Escrow Rules'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleTab('support')} 
                  className="hover:text-teal-600 transition-colors cursor-pointer text-teal-600 dark:text-teal-400"
                >
                  {isBn ? 'মতামত ও অভিযোগ বক্স' : 'Feedback & Complaints'}
                </button>
              </li>
            </ul>
          </div>

          {/* Official Support & Payment Channels */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">
              {isBn ? 'অফিসিয়াল যোগাযোগ ও পেমেন্ট' : 'Support & Payment'}
            </h4>
            <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <a href="mailto:support@microearnbd.com" className="hover:text-emerald-600 font-mono">
                  support@microearnbd.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <button
                  onClick={() => { playSound('click'); onOpenSupport(); }}
                  className="hover:text-emerald-600 cursor-pointer text-left"
                >
                  {isBn ? 'টেলিগ্রাম ও হোয়াটসঅ্যাপ সাপোর্ট' : 'Telegram & WhatsApp Support'}
                </button>
              </div>
            </div>
            <div className="pt-1">
              <button
                onClick={() => { playSound('click'); onOpenWallet(); }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-extrabold text-xs sm:text-sm border border-pink-200 dark:border-pink-800 hover:border-pink-500 transition-colors cursor-pointer"
              >
                bKash Personal: 01312839525
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Copyright, Direct Legal Links & Discreet Secret Admin Access Triggers */}
        <div className="pt-6 flex flex-col items-center justify-center text-center gap-3.5 text-xs text-slate-500 dark:text-slate-400">
          
          {/* Copyright text + Strict Admin-Only Access Triggers */}
          <div className="flex items-center gap-2 select-none">
            <span
              onClick={handleSecretCopyrightClick}
              className={
                isAuthorizedAdmin
                  ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors active:scale-[0.99]'
                  : 'transition-colors'
              }
              title="© MicroEarn BD"
            >
              © {new Date().getFullYear()} <strong>MicroEarn BD</strong>. সর্বস্বত্ব সংরক্ষিত।
            </span>

            {isAuthorizedAdmin && (
              <button
                onClick={() => {
                  playSound('click');
                  onOpenSecretAdmin();
                }}
                className="p-1 rounded opacity-40 hover:opacity-100 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all cursor-pointer"
                title="Admin Security Console"
                aria-label="Secret Admin Access"
              >
                <Shield className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Bottom Policy Bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <button
              onClick={() => { playSound('click'); onOpenPolicyPage('privacy'); }}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors cursor-pointer"
            >
              {isBn ? 'প্রাইভেসি পলিসি' : 'Privacy Policy'}
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => { playSound('click'); onOpenPolicyPage('terms'); }}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors cursor-pointer"
            >
              {isBn ? 'শর্তাবলী' : 'Terms & Conditions'}
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => { playSound('click'); onOpenPolicyPage('contact'); }}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors cursor-pointer"
            >
              {isBn ? 'যোগাযোগ ও সহায়তা' : 'Contact Us'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Made with</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
              <span>for Bangladesh E-earners</span>
            </div>

            {isAuthorizedAdmin && (
              <button
                onClick={() => {
                  playSound('click');
                  onOpenSecretAdmin();
                }}
                className="p-1 rounded-md text-emerald-500/70 hover:text-emerald-500 transition-colors cursor-pointer"
                title="Admin Panel Access"
                aria-label="Secret Admin Access"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </footer>
  );
};
