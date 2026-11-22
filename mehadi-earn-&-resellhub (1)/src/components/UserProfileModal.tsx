import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  Award, 
  ShieldCheck, 
  Coins, 
  RefreshCw,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { 
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { playSound } from '../utils/audio';
import { UserAccount } from '../types';

interface UserProfileModalProps {
  balance: number;
  coins: number;
  currentUser?: UserAccount | null;
  onConvertCoins: () => void;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  balance,
  coins,
  currentUser,
  onConvertCoins,
  onClose
}) => {
  const userName = currentUser?.name || 'সম্মানিত সদস্য';
  const userEmail = currentUser?.email || 'লগইন করা নেই';
  const userPhone = currentUser?.phone || 'লগইন করা নেই';
  const memberTier = currentUser?.memberTier || 'ভেরিফাইড মেম্বার';

  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nameStr.slice(0, 2).toUpperCase();
  };

  // Secure Firebase Email Verification / Password Reset Flow
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const handleSendSecurePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    const targetEmail = (emailInput.trim() || userEmail.trim() || auth.currentUser?.email || currentUser?.email || '').toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setPinError('নিবন্ধিত কোনো বৈধ জিমেইল ঠিকানা পাওয়া যায়নি।');
      playSound('error');
      return;
    }

    setIsSendingResetEmail(true);
    playSound('coin');

    try {
      // Send official Firebase Password Reset Link directly to their Gmail via configured Custom SMTP
      await sendPasswordResetEmail(auth, targetEmail);
      playSound('success');
      setPinSuccess(
        `অফিসিয়াল পাসওয়ার্ড রিসেট লিংক আপনার জিমেইলে (${targetEmail}) সফলভাবে পাঠানো হয়েছে! ইনবক্স অথবা স্প্যাম (Spam) ফোল্ডার চেক করে লিংকে ক্লিক করে নতুন পিন/পাসওয়ার্ড সেট করুন।`
      );
    } catch (err: unknown) {
      console.error('Password reset email error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        setPinError('এই জিমেইলে কোনো একাউন্ট নেই');
      } else if (code === 'auth/too-many-requests') {
        setPinError('অতিরিক্ত অনুরোধ করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
      } else if (code === 'auth/invalid-email') {
        setPinError('সঠিক জিমেইল ঠিকানা লিখুন');
      } else {
        setPinError('ইমেইল পাঠানো যায়নি: ' + ((err as Error)?.message || 'ত্রুটি হয়েছে'));
      }
      playSound('error');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        
        {/* Banner with Prominent Close (X) Button */}
        <div className="h-28 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 relative">
          <button
            type="button"
            onClick={() => { playSound('click'); onClose(); }}
            className="absolute top-3.5 right-3.5 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/95 hover:bg-rose-600 text-rose-600 hover:text-white border-2 border-white/60 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-md"
            aria-label="Close Profile Modal"
            title="বন্ধ করুন (×)"
          >
            &times;
          </button>
        </div>

        {/* Profile Card Header with Avatar */}
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-12 mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500 to-cyan-500 border-4 border-white dark:border-slate-900 shadow-xl flex items-center justify-center text-white text-3xl font-black">
                {getInitials(userName)}
              </div>
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white" title="সক্রিয়">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                {memberTier}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {userName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>সদস্য আইডি: {currentUser?.id ? `#${currentUser.id}` : 'N/A'}</span>
              {currentUser?.joinedDate && (
                <>
                  <span>•</span>
                  <span>যোগদান: {currentUser.joinedDate}</span>
                </>
              )}
            </p>
          </div>

          {/* Quick Balance & Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 my-5">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-center">
              <div className="text-[10px] text-slate-400">ওয়ালেট ব্যালেন্স</div>
              <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                ৳{balance.toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800 text-center">
              <div className="text-[10px] text-slate-400">এস্ক্রো পেন্ডিং</div>
              <div className="text-base font-black text-cyan-600 dark:text-cyan-400 mt-0.5 font-mono">
                ৳{(currentUser?.pendingEscrowBalance || 0).toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-center">
              <div className="text-[10px] text-slate-400">কয়েন ওয়ালেট</div>
              <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {coins.toLocaleString('bn-BD')}
              </div>
            </div>
          </div>

          {/* Instant 1,000 Coin Conversion Action */}
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">কয়েন কনভার্ট (১,০০০ কয়েন = ৳১.০০)</span>
                <span className="text-[11px] text-slate-500">তাৎক্ষণিক মূল ওয়ালেটে টাকা যোগ করুন</span>
              </div>
            </div>
            <button
              type="button"
              disabled={coins < 1000}
              onClick={() => { playSound('coin'); onConvertCoins(); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                coins >= 1000
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>কনভার্ট করুন</span>
            </button>
          </div>

          {/* User Details (Zero Referral Clutter) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                ইমেইল:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{userEmail}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" />
                ফোন নাম্বার:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{userPhone}</span>
            </div>

            <div className="flex items-center justify-between py-1 text-slate-400">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                প্রোফাইল স্ট্যাটাস:
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                {currentUser ? 'নিবন্ধিত ও সুরক্ষিত' : 'লগইন আবশ্যক'}
              </span>
            </div>
          </div>

          {/* User PIN / Password Change Trigger Button */}
          {currentUser && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setShowPinModal(true);
                  setEmailInput(userEmail && userEmail.includes('@') ? userEmail : (auth.currentUser?.email || ''));
                  setPinError(null);
                  setPinSuccess(null);
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>পিন / পাসওয়ার্ড পরিবর্তন করুন (অফিসিয়াল জিমেইল লিংক)</span>
              </button>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* SUB-MODAL: USER PIN / PASSWORD CHANGE WITH ON-SCREEN OTP SIMULATION       */}
        {/* ========================================================================= */}
        {showPinModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-500/40 p-5 sm:p-6 space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">
                    পিন / পাসওয়ার্ড পরিবর্তন
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => { playSound('click'); setShowPinModal(false); }}
                  className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center cursor-pointer transition-all shadow-sm shrink-0"
                  aria-label="Close PIN Modal"
                  title="বন্ধ করুন (×)"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSendSecurePasswordReset} className="space-y-4">
                {/* Account Email Capture: Validates and transmits to Firebase Custom SMTP */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                      নিবন্ধিত জিমেইল ঠিকানা:
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">ভেরিফাইড অ্যাকাউন্ট</span>
                  </div>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={e => {
                      setEmailInput(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    placeholder="yourname@gmail.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Firebase Custom SMTP কনফিগারেশনের মাধ্যমে সরাসরি আপনার জিমেইলে অফিশিয়াল পাসওয়ার্ড রিসেট লিংক পৌঁছে যাবে।
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>অফিসিয়াল জিমেইল ভেরিফিকেশন ফ্লো</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                    নিচের বাটনে ক্লিক করলে Firebase আপনার উপরোক্ত জিমেইলে একটি সুরক্ষিত রিসেট লিংক পাঠাবে। কেবলমাত্র আপনি আপনার জিমেইল ওপেন করে লিংকে ক্লিক করলেই পাসওয়ার্ড/পিন পরিবর্তন করতে পারবেন।
                  </p>
                </div>

                {pinError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                {pinSuccess && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{pinSuccess}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSendingResetEmail}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{isSendingResetEmail ? 'লিংক পাঠানো হচ্ছে...' : 'অফিসিয়াল ভেরিফিকেশন লিংক পাঠান'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
