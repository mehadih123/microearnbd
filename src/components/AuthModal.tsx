import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Phone,
  Lock,
  User,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Globe,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  ensureFirestoreUserProfile,
  savePendingSignupProfile,
  clearPendingSignupProfile,
  formatFirebaseAuthErrorMessage,
  isEmbeddedWebView,
  savePendingGoogleRedirectState,
  clearPendingGoogleRedirectState
} from '../firebase';
import { UserAccount, Language } from '../types';
import { playSound } from '../utils/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserAccount, isNewSignup?: boolean) => void;
  guestCoins?: number;
  language: Language;
  onToggleLanguage: () => void;
  initialMode?: 'login' | 'signup';
  blockedNoticeUser?: { name: string; phone: string; reason?: string } | null;
  onClearBlockedNotice?: () => void;
  onSubmitBlockedComplaint?: (name: string, phone: string, message: string) => void;
  externalError?: string;
  onClearExternalError?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  guestCoins = 0,
  language,
  onToggleLanguage,
  initialMode = 'login',
  blockedNoticeUser = null,
  onClearBlockedNotice,
  onSubmitBlockedComplaint,
  externalError = '',
  onClearExternalError
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode, isOpen]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Email verification pending state (for newly created Email/Password accounts)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  // Forgot Password (Firebase sendPasswordResetEmail)
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Blocked User Appeal Form State
  const [detectedBlockedUser, setDetectedBlockedUser] = useState<{
    name: string;
    phone: string;
    reason?: string;
  } | null>(null);
  const [appealName, setAppealName] = useState('');
  const [appealPhone, setAppealPhone] = useState('');
  const [appealMessage, setAppealMessage] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  const isBn = language === 'bn';

  React.useEffect(() => {
    if (blockedNoticeUser) {
      setDetectedBlockedUser(blockedNoticeUser);
      setAppealName(blockedNoticeUser.name);
      setAppealPhone(blockedNoticeUser.phone);
      setAppealMessage('');
      setAppealSubmitted(false);
    }
  }, [blockedNoticeUser]);

  const mapFirebaseAuthError = useCallback(
    (err: unknown): string => formatFirebaseAuthErrorMessage(err, isBn),
    [isBn]
  );

  const completeGoogleUserLogin = useCallback(
    async (fbUser: NonNullable<typeof auth.currentUser>) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const profile = await ensureFirestoreUserProfile(fbUser, {
        name: name.trim() || fbUser.displayName || undefined,
        phone: cleanPhone || undefined,
        guestCoins
      });

      if (profile && profile.isBlocked) {
        playSound('error');
        setDetectedBlockedUser({
          name: profile.name,
          phone: profile.phone || fbUser.email || '',
          reason: profile.blockReason
        });
        setAppealName(profile.name);
        setAppealPhone(profile.phone || fbUser.email || '');
        setIsLoading(false);
        return true;
      }

      if (profile) {
        clearPendingGoogleRedirectState();
        playSound('success');
        onSuccess(profile, mode === 'signup');
        return true;
      }
      return false;
    },
    [guestCoins, mode, name, onSuccess, phone]
  );

  const resolveLoginError = async (err: unknown, userEmail: string): Promise<string> => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/user-not-found') {
      return isBn ? 'এই জিমেইলে কোনো একাউন্ট নেই' : 'No account found for this Gmail/Email.';
    }
    if (code === 'auth/wrong-password') {
      return isBn ? 'আপনার সঠিক পিন/পাসওয়ার্ড দিয়ে প্রবেশ করুন' : 'Please enter your correct PIN/password.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
      try {
        const methods = await fetchSignInMethodsForEmail(auth, userEmail);
        if (!methods || methods.length === 0) {
          return isBn ? 'এই জিমেইলে কোনো একাউন্ট নেই' : 'No account found for this Gmail/Email.';
        } else {
          return isBn ? 'আপনার সঠিক পিন/পাসওয়ার্ড দিয়ে প্রবেশ করুন' : 'Please enter your correct PIN/password.';
        }
      } catch {
        return isBn ? 'আপনার সঠিক পিন/পাসওয়ার্ড দিয়ে প্রবেশ করুন' : 'Please enter your correct PIN/password.';
      }
    }
    return mapFirebaseAuthError(err);
  };

  // 1-Click Google Sign-In / Sign-Up (Pre-verified email_verified === true)
  const handleGoogleSignIn = async () => {
    setError('');
    setInfoNotice('');
    if (onClearExternalError) onClearExternalError();
    setIsLoading(true);
    playSound('click');

    let didStartRedirect = false;

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await completeGoogleUserLogin(cred.user);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';

      // Some mobile browsers authenticate in the popup before opener messaging completes
      if (
        (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') &&
        auth.currentUser &&
        (auth.currentUser.emailVerified ||
          auth.currentUser.providerData?.some(p => p.providerId === 'google.com'))
      ) {
        try {
          const completed = await completeGoogleUserLogin(auth.currentUser);
          if (completed) return;
        } catch {
          // Fall through to normal error reporting
        }
      }

      const canFallbackToRedirect =
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          code === 'auth/internal-error') &&
        typeof window !== 'undefined' &&
        window.self === window.top;

      if (canFallbackToRedirect) {
        if (isEmbeddedWebView()) {
          playSound('error');
          setError(
            isBn
              ? 'ইন-অ্যাপ ব্রাউজার (Facebook/Instagram/Telegram WebView) থেকে Google লগইন ব্লক থাকে। অনুগ্রহ করে উপরের মেনু (⋮) থেকে "Open in Chrome / Safari" চাপুন অথবা নিচের ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।'
              : 'In-app WebViews block Google Sign-In. Please tap the menu (⋮) and choose "Open in Chrome / Safari", or sign in with Email & Password below.'
          );
          return;
        }

        try {
          savePendingGoogleRedirectState({
            mode,
            name: name.trim(),
            phone: phone.replace(/\D/g, ''),
            guestCoins
          });
          didStartRedirect = true;
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          didStartRedirect = false;
          clearPendingGoogleRedirectState();
          playSound('error');
          setError(mapFirebaseAuthError(redirectErr));
          return;
        }
      }

      playSound('error');
      if (isEmbeddedWebView() && code !== 'auth/popup-closed-by-user') {
        setError(
          isBn
            ? 'ইন-অ্যাপ ব্রাউজার থেকে Google লগইন সম্পন্ন হয়নি। অনুগ্রহ করে Chrome বা Safari ব্রাউজারে ওপেন করুন অথবা ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।'
            : 'Google Sign-In cannot complete inside an in-app browser. Please open in Chrome/Safari or use Email & Password.'
        );
      } else {
        setError(mapFirebaseAuthError(err));
      }
    } finally {
      if (!didStartRedirect) {
        setIsLoading(false);
      }
    }
  };

  // Email/Password Sign-Up & Sign-In via Firebase Auth
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoNotice('');

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError(isBn ? 'সঠিক জিমেইল / ইমেইল ঠিকানা দিন (যেমন: example@gmail.com)' : 'Enter a valid email address');
      playSound('error');
      return;
    }

    if (!password || password.length < 6) {
      setError(
        isBn
          ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর বা সংখ্যার হতে হবে!'
          : 'Password must be at least 6 characters'
      );
      playSound('error');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (mode === 'signup') {
      if (!name.trim() || name.trim().length < 2) {
        setError(isBn ? 'আপনার পূর্ণ নাম প্রদান করুন (কমপক্ষে ২ অক্ষর)' : 'Please enter your full name (at least 2 letters)');
        playSound('error');
        return;
      }
      if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
        setError(
          isBn
            ? 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'
            : 'Enter a valid 11-digit BD phone number'
        );
        playSound('error');
        return;
      }
    }

    setIsLoading(true);
    playSound('coin');

    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        savePendingSignupProfile({
          email: trimmedEmail,
          name: name.trim(),
          phone: cleanPhone
        });

        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          setPendingVerificationEmail(trimmedEmail);
          setInfoNotice(
            isBn
              ? `${trimmedEmail} ঠিকানায় ভেরিফিকেশন ইমেইল পাঠানো হয়েছে! আপনার ইনবক্স/স্প্যাম ফোল্ডার থেকে লিংকে ক্লিক করে নিচে "ভেরিফিকেশন সম্পন্ন হয়েছে" বাটনে চাপুন।`
              : `Verification email sent to ${trimmedEmail}! Click the link in your inbox, then tap "I've Verified My Email" below.`
          );
          playSound('success');
          setIsLoading(false);
          return;
        }

        const profile = await ensureFirestoreUserProfile(cred.user, {
          name: name.trim(),
          phone: cleanPhone,
          guestCoins
        });
        if (profile) {
          playSound('success');
          onSuccess(profile, true);
        }
      } else {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        if (!cred.user.emailVerified) {
          setPendingVerificationEmail(trimmedEmail);
          setInfoNotice(
            isBn
              ? 'অ্যাকাউন্ট সক্রিয় করতে আপনার ইমেইল ভেরিফাই করুন। ইনবক্সে পাঠানো লিংকে ক্লিক করে নিচের বাটনে চাপুন।'
              : 'Please verify your email address before continuing.'
          );
          setIsLoading(false);
          return;
        }

        const profile = await ensureFirestoreUserProfile(cred.user, {
          phone: cleanPhone || undefined,
          guestCoins
        });

        if (profile && profile.isBlocked) {
          playSound('error');
          setDetectedBlockedUser({
            name: profile.name,
            phone: profile.phone || trimmedEmail,
            reason: profile.blockReason
          });
          setAppealName(profile.name);
          setAppealPhone(profile.phone || trimmedEmail);
          setIsLoading(false);
          return;
        }

        if (profile) {
          playSound('success');
          onSuccess(profile, false);
        }
      }
    } catch (err) {
      playSound('error');
      if (mode === 'login') {
        const specificMsg = await resolveLoginError(err, trimmedEmail);
        setError(specificMsg);
      } else {
        setError(mapFirebaseAuthError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckEmailVerified = useCallback(async (silent = false) => {
    if (!auth.currentUser) return;
    if (!silent) {
      setError('');
      setIsLoading(true);
    }
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      if (!auth.currentUser.emailVerified) {
        if (!silent) {
          playSound('error');
          setError(
            isBn
              ? 'ইমেইল এখনো ভেরিফাই হয়নি! অনুগ্রহ করে আপনার জিমেইল ইনবক্স বা Spam ফোল্ডার চেক করে ভেরিফিকেশন লিংকে ক্লিক করুন।'
              : 'Email is not verified yet. Please click the verification link in your inbox.'
          );
        }
        return;
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const profile = await ensureFirestoreUserProfile(auth.currentUser, {
        name: name.trim() || auth.currentUser.displayName || undefined,
        phone: cleanPhone || undefined,
        guestCoins
      });
      if (profile) {
        clearPendingSignupProfile();
        setPendingVerificationEmail(null);
        playSound('success');
        onSuccess(profile, true);
      }
    } catch (err) {
      if (!silent) {
        playSound('error');
        setError(mapFirebaseAuthError(err));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [guestCoins, isBn, name, onSuccess, phone]);

  const checkVerifiedRef = useRef(handleCheckEmailVerified);
  useEffect(() => {
    checkVerifiedRef.current = handleCheckEmailVerified;
  }, [handleCheckEmailVerified]);

  useEffect(() => {
    if (!isOpen || !pendingVerificationEmail) return;
    const onResume = () => {
      if (document.visibilityState === 'visible') {
        void checkVerifiedRef.current(true);
      }
    };
    const onFocus = () => {
      void checkVerifiedRef.current(true);
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onFocus);
    };
  }, [isOpen, pendingVerificationEmail]);

  // Recover if mobile browser completed Google auth in another tab/popup and returned focus
  useEffect(() => {
    if (!isOpen || !isLoading || pendingVerificationEmail || detectedBlockedUser) return;
    const tryRecoverPopupSession = () => {
      const fbUser = auth.currentUser;
      const isGoogleUser = Boolean(fbUser?.providerData?.some(p => p.providerId === 'google.com'));
      if (fbUser && (fbUser.emailVerified || isGoogleUser)) {
        void completeGoogleUserLogin(fbUser).catch(() => {});
      }
    };
    const onResume = () => {
      if (document.visibilityState === 'visible') {
        tryRecoverPopupSession();
      }
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', tryRecoverPopupSession);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', tryRecoverPopupSession);
    };
  }, [isOpen, isLoading, pendingVerificationEmail, detectedBlockedUser, completeGoogleUserLogin]);

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setError('');
    try {
      await sendEmailVerification(auth.currentUser);
      playSound('coin');
      setInfoNotice(
        isBn
          ? 'নতুন ভেরিফিকেশন লিংক আপনার জিমেইলে পাঠানো হয়েছে!'
          : 'Verification email resent! Please check your inbox.'
      );
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    }
  };

  const handleSendPasswordReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setRecoverySuccess('');
    const target = (resetEmail.trim() || email.trim()).toLowerCase();
    if (!target || !target.includes('@')) {
      setError(isBn ? 'আপনার নিবন্ধিত জিমেইল ঠিকানা লিখুন' : 'Enter your registered Gmail address');
      playSound('error');
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, target);
      playSound('success');
      setRecoverySuccess(
        isBn
          ? `${target} ঠিকানায় অফিসিয়াল পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে! ইনবক্স অথবা স্প্যাম (Spam) ফোল্ডার চেক করে লিংকে ক্লিক করুন।`
          : `Password reset email sent to ${target}! Please check your inbox or spam folder.`
      );
    } catch (err: unknown) {
      playSound('error');
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        setError(isBn ? 'এই জিমেইলে কোনো একাউন্ট নেই' : 'No account found for this Gmail address.');
      } else if (code === 'auth/invalid-email') {
        setError(isBn ? 'সঠিক জিমেইল ঠিকানা লিখুন' : 'Please provide a valid Gmail address.');
      } else if (code === 'auth/too-many-requests') {
        setError(isBn ? 'অতিরিক্ত অনুরোধ করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'Too many requests. Please try again later.');
      } else {
        setError(
          isBn
            ? `ইমেইল পাঠানো যায়নি: ${(err as Error)?.message || 'ত্রুটি হয়েছে'}`
            : `Failed to send reset email: ${(err as Error)?.message || 'Error occurred'}`
        );
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleAppealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim()) return;

    if (onSubmitBlockedComplaint) {
      onSubmitBlockedComplaint(
        appealName || 'ইউজার',
        appealPhone || phone || email,
        appealMessage.trim()
      );
    }

    playSound('success');
    setAppealSubmitted(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
      <div className="relative my-auto w-full max-w-[436px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Top Header Banner with Language & Prominent Close (X) Button */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white relative shrink-0">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleLanguage}
                className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isBn ? 'EN' : 'বাংলা'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  if (onClearExternalError) onClearExternalError();
                  onClose();
                }}
                className="w-10 h-10 rounded-2xl bg-white/95 hover:bg-rose-600 text-rose-600 hover:text-white border-2 border-white/60 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
                aria-label="Close Auth Modal"
                title="বন্ধ করুন (×)"
              >
                &times;
              </button>
            </div>
          </div>

          <h3 className="text-xl font-black">MicroEarn BD</h3>
          <p className="text-xs text-emerald-100 mt-0.5">
            {isBn
              ? 'Firebase ক্লাউড অথেনটিকেশন — সকল ডিভাইসে রিয়েল-টাইম সিঙ্ক'
              : 'Firebase Cloud Auth — Live Real-Time Sync Across Devices'}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
        {detectedBlockedUser ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <h4 className="font-extrabold text-sm text-rose-700 dark:text-rose-300">
                  {isBn ? 'অ্যাকাউন্ট স্থগিত / ব্লক নোটিশ' : 'Account Blocked Notice'}
                </h4>
              </div>

              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-semibold">
                {isBn
                  ? 'আপনার অ্যাকাউন্ট ব্লক করা হয়েছে। এ বিষয়ে কোনো মতামত বা অভিযোগ থাকলে এখানে জানান।'
                  : 'Your account has been blocked. Submit an appeal below.'}
              </p>

              {detectedBlockedUser.reason && (
                <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 text-[11px] font-mono text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  <span className="font-bold">ব্লক করার কারণ:</span> {detectedBlockedUser.reason}
                </div>
              )}
            </div>

            {appealSubmitted ? (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <div>
                  <h4 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-200">
                    {isBn ? 'অভিযোগ সফলভাবে পাঠানো হয়েছে!' : 'Complaint Submitted Successfully!'}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    {isBn
                      ? 'আপনার আবেদনটি অ্যাডমিন প্যানেলের ইনবক্সে জমা হয়েছে।'
                      : 'Your appeal has been routed to the Admin Inbox.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetectedBlockedUser(null);
                    setAppealSubmitted(false);
                    if (onClearBlockedNotice) onClearBlockedNotice();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {isBn ? 'লগইন স্ক্রিনে ফিরে যান' : 'Back to Login'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isBn ? 'অ্যাডমিনের কাছে অভিযোগ / আপিল ফর্ম:' : 'Complaint / Appeal Form:'}
                </div>

                <input
                  type="text"
                  required
                  value={appealName}
                  onChange={e => setAppealName(e.target.value)}
                  placeholder="আপনার নাম"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />

                <input
                  type="text"
                  required
                  value={appealPhone}
                  onChange={e => setAppealPhone(e.target.value)}
                  placeholder="01XXXXXXXXX / Gmail"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />

                <textarea
                  rows={3}
                  required
                  value={appealMessage}
                  onChange={e => setAppealMessage(e.target.value)}
                  placeholder={
                    isBn ? 'আপনার অ্যাকাউন্ট আনব্লক করার অনুরোধ লিখুন...' : 'Write your appeal message...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{isBn ? 'অভিযোগ জমা দিন' : 'Submit Complaint'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedBlockedUser(null);
                      if (onClearBlockedNotice) onClearBlockedNotice();
                    }}
                    className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {isBn ? 'অন্য একাউন্ট' : 'Switch'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : pendingVerificationEmail ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <h4 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>{isBn ? 'ইমেইল ভেরিফিকেশন আবশ্যক' : 'Verify Your Email'}</span>
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                {infoNotice ||
                  (isBn
                    ? `${pendingVerificationEmail} ঠিকানায় ভেরিফিকেশন লিংক পাঠানো হয়েছে।`
                    : `Verification link sent to ${pendingVerificationEmail}.`)}
              </p>
            </div>

            {error && (
              <div className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleCheckEmailVerified(false)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>
                {isBn ? 'ভেরিফিকেশন সম্পন্ন হয়েছে — প্রবেশ করুন' : "I've Verified My Email — Continue"}
              </span>
            </button>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                {isBn ? 'পুনরায় ভেরিফিকেশন ইমেইল পাঠান' : 'Resend Verification Email'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPendingSignupProfile();
                  setPendingVerificationEmail(null);
                  setError('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                {isBn ? 'পিছনে যান' : 'Back'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab switch */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setMode('login');
                  setError('');
                  setInfoNotice('');
                  if (onClearExternalError) onClearExternalError();
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center border-b-2 transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {isBn ? 'লগইন করুন (Sign In)' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setMode('signup');
                  setError('');
                  setInfoNotice('');
                  if (onClearExternalError) onClearExternalError();
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center border-b-2 transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {isBn ? 'নতুন রেজিস্ট্রেশন (Sign Up)' : 'Sign Up'}
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Instant 1-Click Google Firebase Auth */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-extrabold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2.5 cursor-pointer transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-emerald-600" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c5.7 0 9.5-4 9.5-9.6 0-.6-.1-1.1-.2-1.6H12z"
                    />
                  </svg>
                )}
                <span>
                  {isLoading
                    ? isBn
                      ? 'Google অ্যাকাউন্ট যাচাই হচ্ছে...'
                      : 'Completing Google Sign-In...'
                    : isBn
                      ? 'Google (Gmail) দিয়ে তাৎক্ষণিক প্রবেশ করুন'
                      : 'Continue Instantly with Google'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span>{isBn ? 'অথবা ইমেইল ও পাসওয়ার্ড দিয়ে' : 'OR WITH EMAIL & PASSWORD'}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                        {isBn ? 'আপনার পূর্ণ নাম *' : 'Full Name *'}
                      </label>
                      <div className="relative">
                        <User className="w-5 h-5 absolute left-3.5 top-3.5 sm:top-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          maxLength={100}
                          placeholder={isBn ? 'যেমন: মেহেদী হাসান' : 'Full Name'}
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 sm:py-3.5 text-sm sm:text-base font-bold rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                        {isBn ? 'মোবাইল নম্বর (Phone Number) *' : 'Phone Number *'}
                      </label>
                      <div className="relative">
                        <Phone className="w-5 h-5 absolute left-3.5 top-3.5 sm:top-4 text-slate-400" />
                        <input
                          type="tel"
                          required
                          maxLength={11}
                          placeholder="017XXXXXXXX"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 sm:py-3.5 text-sm sm:text-base font-bold font-mono rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                    {isBn ? 'জিমেইল / ইমেইল ঠিকানা (Gmail Address) *' : 'Gmail / Email Address *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3.5 top-3.5 sm:top-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      maxLength={160}
                      placeholder="example@gmail.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 sm:py-3.5 text-sm sm:text-base font-bold font-mono rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      {isBn ? 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *' : 'Password (min 6 chars) *'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setResetEmail(email);
                          setError('');
                        }}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        {isBn ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-3.5 sm:top-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 sm:py-3.5 text-sm sm:text-base font-bold font-mono rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                    />
                  </div>
                </div>

                {(error || externalError) && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error || externalError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>{isBn ? 'যাচাই করা হচ্ছে...' : 'Authenticating...'}</span>
                  ) : (
                    <>
                      <span>
                        {mode === 'login'
                          ? isBn
                            ? 'লগইন করুন'
                            : 'Sign In Now'
                          : isBn
                            ? 'রেজিস্ট্রেশন সম্পন্ন করুন'
                            : 'Complete Registration'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {isForgotPassword && (
                <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-teal-200 dark:border-teal-800">
                    <h5 className="font-bold text-xs text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-teal-600" />
                      <span>{isBn ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠান (Custom SMTP)' : 'Password Reset Email'}</span>
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setIsForgotPassword(false);
                        setRecoverySuccess('');
                        setError('');
                      }}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-600 text-rose-600 hover:text-white border border-teal-200 dark:border-slate-700 font-black text-lg leading-none flex items-center justify-center cursor-pointer transition-all shrink-0"
                      aria-label="Close reset"
                      title="বন্ধ করুন (×)"
                    >
                      &times;
                    </button>
                  </div>

                  {recoverySuccess ? (
                    <div className="p-3.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 text-xs font-semibold leading-relaxed text-center border border-emerald-300 dark:border-emerald-800">
                      {recoverySuccess}
                    </div>
                  ) : (
                    <form onSubmit={handleSendPasswordReset} className="space-y-2.5">
                      <p className="text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                        {isBn
                          ? 'আপনার অ্যাকাউন্টের নিবন্ধিত জিমেইল লিখুন। একটি অফিসিয়াল পাসওয়ার্ড রিসেট লিংক সরাসরি পাঠানো হবে:'
                          : 'Enter your registered Gmail address. An official reset link will be sent:'}
                      </p>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="example@gmail.com"
                          value={resetEmail}
                          onChange={e => {
                            setResetEmail(e.target.value);
                            if (error) setError('');
                          }}
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSendingReset}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" />
                        <span>
                          {isSendingReset
                            ? (isBn ? 'রিসেট লিংক পাঠানো হচ্ছে...' : 'Sending Reset Link...')
                            : (isBn ? 'অফিসিয়াল রিসেট লিংক পাঠান →' : 'Send Official Reset Link →')}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              <div className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {isBn
                    ? 'Firebase Authentication দ্বারা সুরক্ষিত ও গ্লোবাল সিঙ্ককৃত'
                    : 'Secured & Globally Synced by Firebase Auth'}
                </span>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
