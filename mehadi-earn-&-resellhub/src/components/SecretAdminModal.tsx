import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Cpu,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import {
  auth,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  isAuthorizedAdminUser,
  ensureFirestoreUserProfile,
  getAdminPinFromFirestore,
  saveAdminPinToFirestore
} from '../firebase';
import { playSound } from '../utils/audio';

interface SecretAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPin?: string;
  onPinUpdated?: (newPin: string) => void;
  onAuthorized: (token: string) => void;
}

export const SecretAdminModal: React.FC<SecretAdminModalProps> = ({
  isOpen,
  onClose,
  adminPin = '2026',
  onPinUpdated,
  onAuthorized
}) => {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Embedded Master PIN / Password Change state right on the Admin Gateway
  const [mode, setMode] = useState<'login' | 'change_pin'>('login');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinSuccessMessage, setPinSuccessMessage] = useState('');

  const isFirebaseAdminSignedIn = isAuthorizedAdminUser(auth.currentUser);

  if (!isOpen || !isFirebaseAdminSignedIn) return null;

  const resetAll = () => {
    setPin('');
    setErrorMessage('');
    setMode('login');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSuccessMessage('');
  };

  const handleGoogleAdminVerify = async () => {
    setErrorMessage('');
    setIsVerifying(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureFirestoreUserProfile(cred.user);
      if ((cred.user.email || '').toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
        playSound('error');
        setErrorMessage(
          `অনুমোদিত অ্যাডমিন জিমেইল (${BOOTSTRAPPED_ADMIN_EMAIL}) দিয়ে সাইন ইন করুন!`
        );
      } else {
        playSound('success');
      }
    } catch {
      playSound('error');
      setErrorMessage('অ্যাডমিন গুগল যাচাই সম্পন্ন হয়নি। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsVerifying(true);

    try {
      // STRICT SECURITY CHECK: Must be signed in with the exact authorized Admin Gmail
      if (!isAuthorizedAdminUser(auth.currentUser)) {
        playSound('error');
        setErrorMessage(
          `প্রবেশাধিকার সংরক্ষিত! শুধুমাত্র নির্ধারিত অ্যাডমিন জিমেইল (${BOOTSTRAPPED_ADMIN_EMAIL}) দিয়ে লগইন করলে প্রবেশ করা যাবে।`
        );
        setPin('');
        setIsVerifying(false);
        return;
      }

      const enteredPin = pin.trim();
      if (!enteredPin) {
        playSound('error');
        setErrorMessage('অনুগ্রহ করে অ্যাডমিন পিন দিন!');
        setIsVerifying(false);
        return;
      }

      // 1. Fetch remote PIN from Firebase Firestore (fallback to adminPin or '2026')
      let masterPin = (adminPin || '2026').trim();
      try {
        const remotePin = await getAdminPinFromFirestore();
        if (remotePin && remotePin.trim()) {
          masterPin = remotePin.trim();
        }
      } catch (err) {
        console.warn('Firestore PIN fetch fallback:', err);
      }

      // 2. Strict PIN Match Check
      if (enteredPin !== masterPin) {
        playSound('error');
        setErrorMessage('ভুল পিন! পুনরায় চেষ্টা করুন।');
        setPin('');
        setIsVerifying(false);
        return;
      }

      // 3. Ensure admin profile exists
      if (auth.currentUser) {
        try {
          await ensureFirestoreUserProfile(auth.currentUser);
        } catch {}
      }

      // 4. Success: Grant access to Admin Dashboard
      playSound('success');
      resetAll();

      const timestamp = Date.now().toString(36).toUpperCase();
      const randHash = Math.random().toString(36).substring(2, 9).toUpperCase();
      const sessionToken = `ADM-FB-${timestamp}-${randHash}`;
      onAuthorized(sessionToken);
    } catch {
      playSound('error');
      setErrorMessage('ভুল পিন! পুনরায় চেষ্টা করুন।');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangeMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPinSuccessMessage('');

    if (!isFirebaseAdminSignedIn) {
      playSound('error');
      setErrorMessage(`পিন পরিবর্তন করতে আগে অ্যাডমিন Gmail (${BOOTSTRAPPED_ADMIN_EMAIL}) যাচাই করুন!`);
      return;
    }

    const cleanCurrent = currentPinInput.trim();
    const cleanNew = newPinInput.trim();
    const cleanConfirm = confirmPinInput.trim();

    if (cleanNew.length < 4 || cleanNew.length > 16) {
      playSound('error');
      setErrorMessage('নতুন পিন ৪ থেকে ১৬ সংখ্যার মধ্যে হতে হবে!');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      playSound('error');
      setErrorMessage('নতুন পিন ও কনফার্ম পিন মেলেনি!');
      return;
    }

    setIsVerifying(true);
    try {
      let masterPin = (adminPin || '2026').trim();
      try {
        const remotePin = await getAdminPinFromFirestore();
        if (remotePin && remotePin.trim()) {
          masterPin = remotePin.trim();
        }
      } catch {}

      if (cleanCurrent !== masterPin) {
        playSound('error');
        setErrorMessage('বর্তমান মাস্টার পিন সঠিক নয়!');
        setIsVerifying(false);
        return;
      }

      await saveAdminPinToFirestore(cleanNew);
      if (onPinUpdated) {
        onPinUpdated(cleanNew);
      }

      playSound('success');
      setPinSuccessMessage('অ্যাডমিন মাস্টার পিন সফলভাবে ক্লাউডে আপডেট হয়েছে!');
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');

      setTimeout(() => {
        setMode('login');
        setPinSuccessMessage('');
      }, 1500);
    } catch {
      playSound('error');
      setErrorMessage('পিন আপডেট করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-auto w-full max-w-[400px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] flex flex-col bg-slate-900 text-white rounded-3xl shadow-2xl border border-purple-500/40 overflow-hidden">
        {/* Sticky Top Header Bar with Prominent Close (×) Button */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 shrink-0 gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-500/40 text-[10px] font-mono tracking-wider text-purple-300 uppercase">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span>Firebase Admin Gate</span>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound('click');
              resetAll();
              onClose();
            }}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-rose-600 text-white border-2 border-slate-600 hover:border-rose-500 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
            aria-label="Close Secret Admin Modal"
            title="বন্ধ করুন (×)"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 text-center space-y-4">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto shadow-inner ${
            mode === 'change_pin'
              ? 'bg-gradient-to-tr from-amber-950 via-slate-900 to-orange-950 border-amber-500/40 text-amber-400'
              : 'bg-gradient-to-tr from-purple-950 via-slate-900 to-indigo-950 border-purple-500/40 text-purple-400'
          }`}>
            {mode === 'change_pin' ? <KeyRound className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>

          <div>
            <h3 className="text-lg font-black text-white">
              {mode === 'change_pin' ? 'মাস্টার পিন / পাসওয়ার্ড পরিবর্তন' : 'সিক্রেট অ্যাডমিন প্যানেল ভেরিফিকেশন'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'change_pin'
                ? 'সরাসরি অ্যাডমিন মেইন গেট থেকেই নিরাপদভাবে পিন আপডেট করুন'
                : 'মাস্টার পিন ও Firebase অ্যাডমিন সেশন দিয়ে প্রবেশ করুন'}
            </p>
          </div>

          {isFirebaseAdminSignedIn ? (
            <div className="px-3 py-2 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">অ্যাডমিন সংযুক্ত: {auth.currentUser?.email}</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={isVerifying}
              onClick={handleGoogleAdminVerify}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-purple-500/40 text-xs font-bold text-purple-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>১. আগে অ্যাডমিন Gmail যাচাই করুন</span>
            </button>
          )}

          {mode === 'login' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={16}
                    autoFocus
                    required
                    placeholder="••••"
                    value={pin}
                    onChange={e => {
                      setPin(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="w-full text-center text-3xl font-mono tracking-[0.4em] py-3 rounded-2xl bg-slate-950 border border-slate-700 text-purple-300 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                {errorMessage && (
                  <div className="text-xs text-rose-300 font-bold bg-rose-950/70 p-3 rounded-xl border border-rose-700 flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isVerifying ? 'যাচাই হচ্ছে...' : 'পিন যাচাই ও ড্যাশবোর্ডে প্রবেশ'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Prominent Direct Master PIN / Password Change Button on Admin Login Screen */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setErrorMessage('');
                    setPinSuccessMessage('');
                    setMode('change_pin');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>মাস্টার পিন / পাসওয়ার্ড পরিবর্তন করুন</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleChangeMasterPin} className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  বর্তমান মাস্টার পিন *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={16}
                  placeholder="বর্তমান পিন লিখুন"
                  value={currentPinInput}
                  onChange={e => {
                    setCurrentPinInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  নতুন মাস্টার পিন * (৪-১৬ সংখ্যা)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  minLength={4}
                  maxLength={16}
                  placeholder="নতুন পিন লিখুন"
                  value={newPinInput}
                  onChange={e => {
                    setNewPinInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  নতুন পিন পুনরায় নিশ্চিত করুন *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  minLength={4}
                  maxLength={16}
                  placeholder="পুনরায় নতুন পিন লিখুন"
                  value={confirmPinInput}
                  onChange={e => {
                    setConfirmPinInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              {errorMessage && (
                <div className="text-xs text-rose-300 font-bold bg-rose-950/70 p-3 rounded-xl border border-rose-700 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {pinSuccessMessage && (
                <div className="text-xs text-emerald-300 font-bold bg-emerald-950/70 p-3 rounded-xl border border-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{pinSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isVerifying ? 'আপডেট হচ্ছে...' : 'নতুন মাস্টার পিন সেভ করুন'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setErrorMessage('');
                  setPinSuccessMessage('');
                  setMode('login');
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>লগইন পর্দায় ফিরে যান</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
