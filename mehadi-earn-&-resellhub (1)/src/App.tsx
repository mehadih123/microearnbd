import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProductsSection } from './components/ProductsSection';
import { OrderModal } from './components/OrderModal';
import { MicroJobsSection } from './components/MicroJobsSection';
import { MathTaskModal } from './components/MathTaskModal';
import { QuizJobModal } from './components/QuizJobModal';
import { CaptchaModal } from './components/CaptchaModal';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { WalletModal } from './components/WalletModal';
import { UserProfileModal } from './components/UserProfileModal';
import { OfficialChannelModal } from './components/OfficialChannelModal';
import { SideDrawer } from './components/SideDrawer';
import { CreateJobModal } from './components/CreateJobModal';
import { SecretAdminModal } from './components/SecretAdminModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { RulesModal } from './components/RulesModal';
import { SupportFeedbackSection } from './components/SupportFeedbackSection';
import { Footer } from './components/Footer';
import { NotificationToast } from './components/NotificationToast';
import { AuthModal } from './components/AuthModal';
import { BottomNavBar } from './components/BottomNavBar';
import { SpinWinModal } from './components/SpinWinModal';
import { PolicyTrustModal, PolicyPageType } from './components/PolicyTrustModal';
import { SupportChatbotWidget } from './components/SupportChatbotWidget';

import {
  auth,
  db,
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
  ensureFirestoreUserProfile,
  createFirestoreProduct,
  updateFirestoreProduct,
  deleteFirestoreProduct,
  incrementFirestoreUserCoins,
  convertFirestoreUserCoins,
  updateFirestoreUserBalance,
  accrueFirestoreEscrowBalance,
  adminToggleFirestoreUserBlock,
  adminAdjustFirestoreUserBalances,
  createFirestoreOrder,
  adminUpdateFirestoreOrder,
  createFirestoreWithdrawal,
  adminResolveFirestoreWithdrawal,
  createFirestoreMicroJob,
  adminUpdateFirestoreJobStatus,
  adminDeleteFirestoreJob,
  createFirestoreTaskProof,
  adminUpdateFirestoreProofStatus,
  createFirestoreFeedback,
  adminReplyFirestoreFeedback,
  createFirestoreTransaction,
  getAdminPinFromFirestore,
  saveAdminPinToFirestore,
  deleteCurrentUserAccount
} from './firebase';

import {
  INITIAL_MICRO_JOBS,
  INITIAL_NOTIFICATIONS
} from './data/mockData';
import {
  Product,
  Order,
  MicroJob,
  Transaction,
  NotificationItem,
  UserAccount,
  Language,
  TaskProofSubmission,
  WithdrawalRequest,
  FeedbackItem,
  AppTab,
  QuizQuestion
} from './types';
import { toggleMute, playSound } from './utils/audio';
import { fetchQuizQuestions } from './utils/quizApi';

export default function App() {
  // UI Theme preference
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Language state (Bangla & English)
  const [language, setLanguage] = useState<Language>('bn');

  // Sound state
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  // Firebase Auth & Real-Time Firestore State (NO localStorage account/product dependence!)
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [jobs, setJobs] = useState<MicroJob[]>(INITIAL_MICRO_JOBS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [proofs, setProofs] = useState<TaskProofSubmission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [adminPin, setAdminPin] = useState<string>('2026');

  // Live synced balances (guest session coins carry over on login/signup)
  const [balance, setBalance] = useState<number>(0);
  const [pendingEscrowBalance, setPendingEscrowBalance] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);
  const [guestCoins, setGuestCoins] = useState<number>(0);

  // Modals & Drawers States
  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [captchaModalOpen, setCaptchaModalOpen] = useState(false);
  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);
  const [secretAdminModalOpen, setSecretAdminModalOpen] = useState(false);
  const [adminDashboardModalOpen, setAdminDashboardModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [policyModalPage, setPolicyModalPage] = useState<PolicyPageType | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [officialChannelOpen, setOfficialChannelOpen] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Session Token
  const [adminDeviceToken, setAdminDeviceToken] = useState<string | null>(null);

  // Blocked User Notice State
  const [blockedNoticeUser, setBlockedNoticeUser] = useState<{
    name: string;
    phone: string;
    reason?: string;
  } | null>(null);

  // Dynamic External Quiz API State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState<boolean>(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const quizFetchInFlightRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Capture referral code from URL query parameter (e.g. ?ref=USER_ID)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        localStorage.setItem('taskvault_ref', ref.trim());
      }
    } catch {
      // Ignore
    }
  }, []);

  // =========================================================================
  // 1. GLOBAL REAL-TIME STOREFRONT LISTENERS (Products & Active Micro-Jobs)
  // =========================================================================
  useEffect(() => {
    const productsQuery = query(collection(db, 'products'), where('status', '==', 'published'));
    const unsubProducts = onSnapshot(
      productsQuery,
      snapshot => {
        const liveProducts: Product[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: (data.id as string) || d.id,
            title: (data.title as string) || '',
            titleEn: (data.titleEn as string) || '',
            category: (data.category as string) || 'general',
            regularPrice: typeof data.regularPrice === 'number' ? data.regularPrice : undefined,
            customerPrice: Number(data.customerPrice || 0),
            commission: Number(data.commission || 0),
            deliveryChargeInside: Number(data.deliveryChargeInside ?? 60),
            deliveryChargeOutside: Number(data.deliveryChargeOutside ?? 120),
            image: (data.image as string) || '',
            rating: typeof data.rating === 'number' ? data.rating : 4.9,
            soldCount: typeof data.soldCount === 'number' ? data.soldCount : 0,
            stock: typeof data.stock === 'number' ? data.stock : undefined,
            supplier: (data.supplier as string) || 'MicroEarn Direct',
            description: (data.description as string) || '',
            features: Array.isArray(data.features) ? (data.features as string[]) : []
          };
        });
        setProducts(liveProducts);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const activeJobsQuery = query(collection(db, 'jobs'), where('status', '==', 'active'));
    const unsubJobs = onSnapshot(
      activeJobsQuery,
      snapshot => {
        if (snapshot.empty) {
          setJobs([]);
          return;
        }
        const liveJobs: MicroJob[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: (data.id as string) || d.id,
            title: (data.title as string) || '',
            titleEn: data.titleEn as string | undefined,
            category: (data.category as MicroJob['category']) || 'youtube',
            platform: (data.platform as string) || 'YouTube',
            reward: Number(data.reward || 10),
            estimatedTime: (data.estimatedTime as string) || '২ মিনিট',
            completedSlots: Number(data.completedSlots || 0),
            totalSlots: Number(data.totalSlots || 100),
            instructions: Array.isArray(data.instructions) ? (data.instructions as string[]) : [],
            proofPlaceholder: (data.proofPlaceholder as string) || 'প্রুফ লিখুন...',
            targetUrl: (data.targetUrl as string) || 'https://youtube.com',
            isUserGenerated: Boolean(data.isUserGenerated),
            postedBy: data.postedBy as string | undefined,
            senderPhone: data.senderPhone as string | undefined,
            paymentTrxId: data.paymentTrxId as string | undefined,
            totalBudget: typeof data.totalBudget === 'number' ? data.totalBudget : undefined,
            status: (data.status as MicroJob['status']) || 'active'
          };
        });
        setJobs(liveJobs);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'jobs');
      }
    );

    return () => {
      unsubProducts();
      unsubJobs();
    };
  }, []);

  // =========================================================================
  // 2. FIREBASE AUTHENTICATION LISTENER & USER PROFILE SYNC
  // =========================================================================
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async fbUser => {
      const isGoogleUser = Boolean(fbUser?.providerData?.some(p => p.providerId === 'google.com'));
      if (!fbUser || (!fbUser.emailVerified && !isGoogleUser)) {
        setCurrentUser(null);
        setBalance(0);
        setPendingEscrowBalance(0);
        setCoins(guestCoins);
        setAuthReady(true);
        return;
      }

      try {
        const profile = await ensureFirestoreUserProfile(fbUser, {
          guestCoins
        });
        if (profile) {
          if (guestCoins > 0) setGuestCoins(0);
          if (profile.isBlocked) {
            setCurrentUser(null);
            setBlockedNoticeUser({
              name: profile.name,
              phone: profile.phone || fbUser.email || '',
              reason: profile.blockReason || 'অ্যাডমিন কর্তৃক অ্যাকাউন্ট স্থগিত'
            });
            setAuthModalOpen(true);
          } else {
            setCurrentUser(profile);
            setBalance(profile.balance);
            setPendingEscrowBalance(profile.pendingEscrowBalance);
            setCoins(profile.coins);
          }
        }
      } catch (err) {
        console.error('Auth profile sync error:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubAuth();
  }, [guestCoins]);

  // =========================================================================
  // 3. AUTHENTICATED USER & ADMIN REAL-TIME FIRESTORE LISTENERS
  // =========================================================================
  useEffect(() => {
    const isGoogleUser = Boolean(auth.currentUser?.providerData?.some(p => p.providerId === 'google.com'));
    if (!authReady || !auth.currentUser || (!auth.currentUser.emailVerified && !isGoogleUser)) {
      return;
    }

    const uid = auth.currentUser.uid;
    const isBootstrappedAdmin =
      (auth.currentUser.email || '').toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const unsubscribers: Array<() => void> = [];

    // Live listener on current user's profile document (syncs coins, BDT balance & instant block status)
    const unsubMyProfile = onSnapshot(
      doc(db, 'users', uid),
      snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const isBlockedNow = Boolean(data.isBlocked);
        if (isBlockedNow) {
          setCurrentUser(null);
          setBlockedNoticeUser({
            name: (data.name as string) || 'ইউজার',
            phone: auth.currentUser?.email || '',
            reason: (data.blockReason as string) || 'অ্যাডমিন কর্তৃক অ্যাকাউন্ট স্থগিত'
          });
          setAuthModalOpen(true);
          playSound('error');
          showToast('আপনার অ্যাকাউন্ট ব্লক করা হয়েছে। সেশন তাৎক্ষণিকভাবে বন্ধ করা হয়েছে!');
          return;
        }

        setBalance(Number(data.balance || 0));
        setPendingEscrowBalance(Number(data.pendingEscrowBalance || 0));
        setCoins(Number(data.coins || 0));
        setCurrentUser(prev =>
          prev
            ? {
                ...prev,
                name: (data.name as string) || prev.name,
                balance: Number(data.balance || 0),
                pendingEscrowBalance: Number(data.pendingEscrowBalance || 0),
                coins: Number(data.coins || 0),
                isBlocked: false
              }
            : prev
        );
      },
      error => {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      }
    );
    unsubscribers.push(unsubMyProfile);

    if (isBootstrappedAdmin) {
      // Load Admin Master PIN from Firestore settings
      void getAdminPinFromFirestore().then(pin => setAdminPin(pin));

      // Admin: Live sync ALL registered users + enrich isolated PII
      const unsubAllUsers = onSnapshot(
        collection(db, 'users'),
        async snapshot => {
          const enriched = await Promise.all(
            snapshot.docs.map(async d => {
              const data = d.data();
              let email = '';
              let phone = '';
              try {
                const piiSnap = await getDoc(doc(db, 'users', d.id, 'private', 'pii'));
                if (piiSnap.exists()) {
                  email = (piiSnap.data().email as string) || '';
                  phone = (piiSnap.data().phone as string) || '';
                }
              } catch {
                // Ignore individual PII read failure
              }
              return {
                id: (data.uid as string) || d.id,
                name: (data.name as string) || 'Member',
                phone,
                email,
                role: (data.role as 'user' | 'admin') || 'user',
                balance: Number(data.balance || 0),
                pendingEscrowBalance: Number(data.pendingEscrowBalance || 0),
                coins: Number(data.coins || 0),
                memberTier: (data.memberTier as string) || 'ভেরিফাইড মেম্বার',
                isBlocked: Boolean(data.isBlocked),
                blockReason: data.blockReason as string | undefined,
                blockedAt: data.blockedAt as string | undefined,
                joinedDate: (data.joinedDate as string) || 'ভেরিফাইড',
                referralCode: (data.referralCode as string) || d.id.slice(0, 8).toUpperCase(),
                referredBy: data.referredBy as string | undefined,
                referralsCount: Number(data.referralsCount || 0),
                referralEarnings: Number(data.referralEarnings || 0)
              } satisfies UserAccount;
            })
          );
          setUsers(enriched);
        },
        error => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      );
      unsubscribers.push(unsubAllUsers);

      // Admin: All Jobs (including pending_admin_approval)
      const unsubAllJobs = onSnapshot(
        query(
          collection(db, 'jobs'),
          where('status', 'in', ['active', 'pending_admin_approval', 'rejected'])
        ),
        snapshot => {
          setJobs(
            snapshot.docs.map(d => {
              const data = d.data();
              return {
                id: (data.id as string) || d.id,
                title: (data.title as string) || '',
                titleEn: data.titleEn as string | undefined,
                category: (data.category as MicroJob['category']) || 'youtube',
                platform: (data.platform as string) || 'Social',
                reward: Number(data.reward || 10),
                estimatedTime: (data.estimatedTime as string) || '২ মিনিট',
                completedSlots: Number(data.completedSlots || 0),
                totalSlots: Number(data.totalSlots || 100),
                instructions: Array.isArray(data.instructions)
                  ? (data.instructions as string[])
                  : [],
                proofPlaceholder: (data.proofPlaceholder as string) || '',
                targetUrl: (data.targetUrl as string) || 'https://youtube.com',
                isUserGenerated: Boolean(data.isUserGenerated),
                postedBy: data.postedBy as string | undefined,
                senderPhone: data.senderPhone as string | undefined,
                paymentTrxId: data.paymentTrxId as string | undefined,
                totalBudget: typeof data.totalBudget === 'number' ? data.totalBudget : undefined,
                status: (data.status as MicroJob['status']) || 'active'
              };
            })
          );
        },
        error => {
          handleFirestoreError(error, OperationType.LIST, 'jobs');
        }
      );
      unsubscribers.push(unsubAllJobs);

      // Admin: All Orders, Withdrawals, Proofs, Feedbacks, Transactions
      unsubscribers.push(
        onSnapshot(
          collection(db, 'orders'),
          snap => setOrders(snap.docs.map(d => d.data() as Order)),
          err => handleFirestoreError(err, OperationType.LIST, 'orders')
        ),
        onSnapshot(
          collection(db, 'withdrawals'),
          snap => setWithdrawals(snap.docs.map(d => d.data() as WithdrawalRequest)),
          err => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
        ),
        onSnapshot(
          collection(db, 'proofs'),
          snap => setProofs(snap.docs.map(d => d.data() as TaskProofSubmission)),
          err => handleFirestoreError(err, OperationType.LIST, 'proofs')
        ),
        onSnapshot(
          collection(db, 'feedbacks'),
          snap => setFeedbacks(snap.docs.map(d => d.data() as FeedbackItem)),
          err => handleFirestoreError(err, OperationType.LIST, 'feedbacks')
        ),
        onSnapshot(
          collection(db, 'transactions'),
          snap => setTransactions(snap.docs.map(d => d.data() as Transaction)),
          err => handleFirestoreError(err, OperationType.LIST, 'transactions')
        )
      );
    } else {
      // Standard Member: Scoped Queries Enforced by resource.data.userId == uid
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'orders'), where('userId', '==', uid)),
          snap => setOrders(snap.docs.map(d => d.data() as Order)),
          err => handleFirestoreError(err, OperationType.LIST, 'orders')
        ),
        onSnapshot(
          query(collection(db, 'withdrawals'), where('userId', '==', uid)),
          snap => setWithdrawals(snap.docs.map(d => d.data() as WithdrawalRequest)),
          err => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
        ),
        onSnapshot(
          query(collection(db, 'proofs'), where('workerId', '==', uid)),
          snap => setProofs(snap.docs.map(d => d.data() as TaskProofSubmission)),
          err => handleFirestoreError(err, OperationType.LIST, 'proofs')
        ),
        onSnapshot(
          query(collection(db, 'feedbacks'), where('userId', '==', uid)),
          snap => setFeedbacks(snap.docs.map(d => d.data() as FeedbackItem)),
          err => handleFirestoreError(err, OperationType.LIST, 'feedbacks')
        ),
        onSnapshot(
          query(collection(db, 'transactions'), where('userId', '==', uid)),
          snap => setTransactions(snap.docs.map(d => d.data() as Transaction)),
          err => handleFirestoreError(err, OperationType.LIST, 'transactions')
        )
      );
    }

    return () => {
      unsubscribers.forEach(fn => fn());
    };
  }, [authReady, currentUser?.id, showToast]);

  // Dynamic Quiz API Fetcher
  const handleFetchQuizQuestions = useCallback(
    async (endpointOverride?: string) => {
      if (quizFetchInFlightRef.current) return;
      quizFetchInFlightRef.current = true;
      setQuizLoading(true);
      setQuizError(null);
      try {
        const fetched = await fetchQuizQuestions(endpointOverride);
        setQuizQuestions(prev => {
          const existingPrompts = new Set(prev.map(q => q.question));
          const uniqueNew = fetched.filter(q => !existingPrompts.has(q.question));
          return [...prev, ...(uniqueNew.length > 0 ? uniqueNew : fetched)];
        });
      } catch {
        setQuizError(
          language === 'bn'
            ? 'কুইজ সার্ভার থেকে প্রশ্ন লোড করা যায়নি। পুনরায় চেষ্টা করুন।'
            : 'Failed to load dynamic quiz questions from API. Please retry.'
        );
      } finally {
        quizFetchInFlightRef.current = false;
        setQuizLoading(false);
      }
    },
    [language]
  );

  const handleConsumeQuizQuestion = useCallback((questionId: string) => {
    setQuizQuestions(prev => prev.filter(q => q.id !== questionId));
  }, []);

  // Dark Mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Secret Keyboard Shortcut (Ctrl + Alt + A) & Hash (#admin) -> Opens PIN Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSecretAdminModalOpen(true);
        playSound('click');
      }
    };

    const handleHash = () => {
      if (window.location.hash === '#admin' || window.location.hash === '#taskvault-admin') {
        setSecretAdminModalOpen(true);
        playSound('click');
      }
    };

    handleHash();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('hashchange', handleHash);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  const handleToggleLanguage = () => {
    setLanguage(prev => (prev === 'bn' ? 'en' : 'bn'));
    playSound('click');
  };

  const handleToggleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
    showToast(muted ? 'সাউন্ড বন্ধ করা হয়েছে' : 'সাউন্ড চালু করা হয়েছে');
  };

  // =========================================================================
  // AUTH & LOGOUT HANDLERS
  // =========================================================================
  const handleAuthSuccess = (user: UserAccount, isNewSignup = false) => {
    setCurrentUser(user);
    setBalance(user.balance);
    setPendingEscrowBalance(user.pendingEscrowBalance);
    setCoins(user.coins);
    setGuestCoins(0);
    setAuthModalOpen(false);
    showToast(
      isNewSignup
        ? language === 'bn'
          ? `রেজিস্ট্রেশন সফল! স্বাগতম, ${user.name}`
          : `Welcome, ${user.name}!`
        : language === 'bn'
          ? `স্বাগতম, ${user.name}!`
          : `Welcome, ${user.name}!`
    );
  };

  const handleLogout = async () => {
    playSound('click');
    await signOut(auth);
    setCurrentUser(null);
    setBalance(0);
    setPendingEscrowBalance(0);
    setCoins(0);
    setAuthModalOpen(true);
    showToast(language === 'bn' ? 'লগআউট সম্পন্ন হয়েছে' : 'Signed out');
  };

  const handleDeleteAccount = async (password?: string) => {
    playSound('click');
    try {
      await deleteCurrentUserAccount(password);
      setCurrentUser(null);
      setBalance(0);
      setPendingEscrowBalance(0);
      setCoins(0);
      setSideDrawerOpen(false);
      showToast('আপনার অ্যাকাউন্ট এবং সমস্ত তথ্য সফলভাবে মুছে ফেলা হয়েছে।');
      playSound('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অ্যাকাউন্ট ডিলিট করতে সমস্যা হয়েছে';
      showToast(msg);
      playSound('error');
      throw err;
    }
  };

  const handleClaimGiftReward = (type: 'coins' | 'balance', amount: number, _code: string) => {
    playSound('coin');
    if (auth.currentUser && currentUser) {
      // Firestore credit, code increment/auto-deactivation, and transaction ledger
      // are already committed atomically inside redeemFirestoreGiftCode.
      if (type === 'coins') {
        setCoins(prev => prev + amount);
      } else {
        setBalance(prev => Math.max(0, Number((prev + amount).toFixed(2))));
      }
    } else {
      if (type === 'coins') {
        setCoins(prev => prev + amount);
        setGuestCoins(prev => prev + amount);
      } else {
        setBalance(prev => Number((prev + amount).toFixed(2)));
      }
    }
  };

  // =========================================================================
  // ADMIN ACTIONS (LIVE FIRESTORE MUTATIONS)
  // =========================================================================
  const handleToggleBlockUser = async (userId: string, reason?: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const shouldBlock = !targetUser.isBlocked;

    await adminToggleFirestoreUserBlock(targetUser, shouldBlock, reason);
    showToast(
      shouldBlock
        ? `ইউজার "${targetUser.name}" ব্লক করা হয়েছে (লাইভ সেশন বন্ধ)`
        : `ইউজার "${targetUser.name}" সফলভাবে আনব্লক করা হয়েছে`
    );
  };

  const handleRevokeAdminDevice = () => {
    setAdminDeviceToken(null);
    setAdminDashboardModalOpen(false);
    playSound('click');
    showToast('অ্যাডমিন প্যানেল লক করা হয়েছে');
  };

  const handleUpdateMasterPin = async (newPin: string) => {
    await saveAdminPinToFirestore(newPin);
    setAdminPin(newPin);
    showToast('মাস্টার পিন ক্লাউডে সংরক্ষিত হয়েছে!');
  };

  // PRODUCT MANAGEMENT (ADMIN -> LIVE FIRESTORE SYNC)
  const handleAddProduct = async (newProduct: Product) => {
    await createFirestoreProduct(newProduct);
    showToast(`নতুন পণ্য "${newProduct.title}" Firebase-এ যুক্ত হয়েছে ও লাইভ হয়েছে!`);
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    await updateFirestoreProduct(updatedProduct);
    showToast('পণ্য তথ্য Firebase-এ আপডেট হয়েছে!');
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteFirestoreProduct(id);
    showToast('পণ্যটি Firebase স্টোর থেকে মুছে ফেলা হয়েছে!');
  };

  // =========================================================================
  // USER & FINANCIAL WORKFLOWS (LIVE FIRESTORE SYNC)
  // =========================================================================
  const handleSubmitBlockedUserComplaint = async (
    name: string,
    phone: string,
    message: string
  ) => {
    if (!auth.currentUser) {
      showToast('অভিযোগ জমা দিতে অনুগ্রহ করে লগইন করুন।');
      return;
    }
    const newFb: FeedbackItem = {
      id: 'FB-APL-' + Date.now().toString().slice(-5),
      userId: auth.currentUser.uid,
      userName: name,
      userPhone: phone,
      category: 'blocked_account_appeal',
      subject: 'ব্লকড অ্যাকাউন্ট আনব্লক করার আবেদন',
      message,
      date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      status: 'pending'
    };
    await createFirestoreFeedback(newFb, auth.currentUser.uid);
    showToast('আপনার অভিযোগ অ্যাডমিন প্যানেলে সফলভাবে জমা হয়েছে!');
  };

  const handleWithdrawSuccess = async (tx: Transaction, req: WithdrawalRequest) => {
    if (!currentUser || !auth.currentUser) return;
    const nextBal = Math.max(0, Number((balance - tx.amount).toFixed(2)));
    await updateFirestoreUserBalance(auth.currentUser.uid, nextBal);
    await createFirestoreWithdrawal({ ...req, userId: auth.currentUser.uid });
    await createFirestoreTransaction(tx, auth.currentUser.uid);

    setNotifications(prev => [
      {
        id: 'notif-' + Date.now(),
        title: 'উত্তোলন রিকোয়েস্ট সফল!',
        message: `আপনার ${tx.method} নম্বরে ৳${tx.amount} পাঠানোর আবেদন গৃহীত হয়েছে। TrxID: ${tx.trxId}`,
        time: 'এইমাত্র',
        type: 'withdrawal',
        read: false
      },
      ...prev
    ]);

    showToast(`উত্তোলন রিকোয়েস্ট জমা হয়েছে! ৳${tx.amount} প্রসেসিং হচ্ছে।`);
  };

  const handleApproveWithdrawal = async (withdrawalId: string) => {
    const targetWdr = withdrawals.find(w => w.id === withdrawalId);
    if (!targetWdr) return;
    const trxId = targetWdr.trxId || 'BK' + Math.random().toString(36).substring(2, 9).toUpperCase();
    await adminResolveFirestoreWithdrawal(withdrawalId, 'approved', { trxId });
    showToast(`উইথড্র রিকোয়েস্ট #${withdrawalId} সফলভাবে অনুমোদন করা হয়েছে!`);
  };

  const handleRejectWithdrawal = async (withdrawalId: string, reason: string) => {
    const targetWdr = withdrawals.find(w => w.id === withdrawalId);
    if (!targetWdr || targetWdr.status === 'rejected') return;

    await adminResolveFirestoreWithdrawal(withdrawalId, 'rejected', { rejectReason: reason });

    const targetUser = users.find(u => u.id === targetWdr.userId);
    if (targetUser) {
      const refundedBalance = Number(((targetUser.balance || 0) + targetWdr.amount).toFixed(2));
      await adminAdjustFirestoreUserBalances(targetUser.id, { balance: refundedBalance });
    }

    const refundTx: Transaction = {
      id: 'TX-REFUND-' + Math.floor(1000 + Math.random() * 9000),
      type: 'withdrawal_refund',
      title: `বাতিলকৃত উইথড্র রিফান্ড: ৳${targetWdr.amount} ফেরত`,
      amount: targetWdr.amount,
      date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      status: 'completed',
      method: targetWdr.method
    };
    await createFirestoreTransaction(refundTx, targetWdr.userId);
    showToast(
      `উইথড্রয়াল #${withdrawalId} বাতিল হয়েছে এবং ৳${targetWdr.amount} ইউজারের ব্যালেন্সে রিফান্ড করা হয়েছে!`
    );
  };

  const handleSubmitOrder = async (newOrder: Order) => {
    if (!currentUser || !auth.currentUser) {
      setSelectedProductForOrder(null);
      setAuthModalOpen(true);
      showToast('অর্ডার বুকিং করতে আগে আপনার অ্যাকাউন্টে লগইন করুন!');
      return;
    }

    await createFirestoreOrder(newOrder, auth.currentUser.uid);
    await accrueFirestoreEscrowBalance(
      auth.currentUser.uid,
      pendingEscrowBalance + newOrder.commission
    );

    const newTx: Transaction = {
      id: 'TX-' + Math.floor(100000 + Math.random() * 900000),
      type: 'resell_commission',
      title: `${newOrder.productTitle} বিক্রির লাভ (এস্ক্রো সুরক্ষায়)`,
      amount: newOrder.commission,
      date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      status: 'pending'
    };
    await createFirestoreTransaction(newTx, auth.currentUser.uid);

    showToast(`অর্ডার বুকিং সফল! কমিশন ৳${newOrder.commission} পেন্ডিং এস্ক্রোতে যুক্ত হয়েছে।`);
  };

  const handleApproveEscrowOrder = async (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId) as
      | (Order & { userId?: string })
      | undefined;
    if (!targetOrder || targetOrder.escrowReleased) return;

    await adminUpdateFirestoreOrder(orderId, {
      status: 'delivered_paid',
      escrowReleased: true
    });

    if (targetOrder.userId) {
      const reseller = users.find(u => u.id === targetOrder.userId);
      if (reseller) {
        await adminAdjustFirestoreUserBalances(reseller.id, {
          balance: Number(((reseller.balance || 0) + targetOrder.commission).toFixed(2)),
          pendingEscrowBalance: Math.max(0, (reseller.pendingEscrowBalance || 0) - targetOrder.commission)
        });
      }

      const releaseTx: Transaction = {
        id: 'TX-REL-' + Math.floor(1000 + Math.random() * 9000),
        type: 'resell_commission',
        title: `অর্ডার #${orderId} ডেলিভার্ড: এস্ক্রো কমিশন রিলিজ`,
        amount: targetOrder.commission,
        date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        status: 'completed'
      };
      await createFirestoreTransaction(releaseTx, targetOrder.userId);
    }

    showToast(`অর্ডার #${orderId} ডেলিভার্ড! ৳${targetOrder.commission} উত্তোলনযোগ্য ব্যালেন্সে যোগ হয়েছে!`);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    await adminUpdateFirestoreOrder(orderId, { status });
    showToast(`অর্ডার #${orderId} এর স্ট্যাটাস আপডেট হয়েছে!`);
  };

  const handleSubmitUserJob = async (job: MicroJob) => {
    if (!currentUser || !auth.currentUser) {
      setCreateJobModalOpen(false);
      setAuthModalOpen(true);
      showToast('কাজ পোস্ট করতে আগে আপনার অ্যাকাউন্টে লগইন করুন!');
      return;
    }

    await createFirestoreMicroJob(job, auth.currentUser.uid);

    const postTx: Transaction = {
      id: 'TX-JOB-' + Math.floor(1000 + Math.random() * 9000),
      type: 'job_posting',
      title: `কাজ পোস্ট ফি: "${job.title}" (${job.totalSlots} জন)`,
      amount: job.totalBudget || 0,
      date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      status: 'pending',
      method: 'bKash',
      trxId: job.paymentTrxId
    };
    await createFirestoreTransaction(postTx, auth.currentUser.uid);

    showToast(
      language === 'bn'
        ? 'কাজটি সাবমিট হয়েছে! এডমিন পেমেন্ট ভেরিফাই করে লাইভ করবে।'
        : 'Job submitted for Admin approval!'
    );
  };

  const handleApproveUserJob = async (jobId: string) => {
    await adminUpdateFirestoreJobStatus(jobId, 'active');
    showToast(
      language === 'bn'
        ? 'ইউজার কাজটি অনুমোদিত হয়েছে এবং পাবলিক বোর্ডে লাইভ হয়েছে!'
        : 'User Job approved & published!'
    );
  };

  const handleRejectUserJob = async (jobId: string) => {
    await adminUpdateFirestoreJobStatus(jobId, 'rejected');
    showToast(language === 'bn' ? 'কাজটি প্রত্যাখ্যান করা হয়েছে।' : 'Job rejected.');
  };

  const handleAdminCreateJob = async (job: MicroJob) => {
    if (!auth.currentUser) {
      showToast('টাস্ক যোগ করতে অনুগ্রহ করে অ্যাডমিন অ্যাকাউন্টে লগইন করুন!');
      return;
    }
    await createFirestoreMicroJob(
      {
        ...job,
        status: 'active',
        isUserGenerated: false
      },
      auth.currentUser.uid
    );
    showToast(`নতুন মাইক্রো-টাস্ক "${job.title}" সফলভাবে লাইভ হয়েছে!`);
  };

  const handleAdminDeleteJob = async (jobId: string) => {
    await adminDeleteFirestoreJob(jobId);
    showToast('মাইক্রো-টাস্কটি Firebase থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে!');
  };

  const handleCompleteJob = async (job: MicroJob, proof: string) => {
    if (!currentUser || !auth.currentUser) {
      setAuthModalOpen(true);
      showToast('কাজের প্রুফ জমা দিতে আগে লগইন করুন!');
      return;
    }

    const newProof: TaskProofSubmission = {
      id: 'prf-' + Date.now(),
      jobId: job.id,
      jobTitle: job.title,
      workerId: auth.currentUser.uid,
      workerName: currentUser.name,
      workerPhone: currentUser.phone || currentUser.email || 'N/A',
      reward: job.reward,
      proofText: proof,
      submittedAt: 'এইমাত্র',
      status: 'pending'
    };
    await createFirestoreTaskProof(newProof, auth.currentUser.uid);
    showToast('আপনার কাজের প্রুফ জমা হয়েছে! এডমিন যাচাইয়ের পর রিওয়ার্ড যোগ হবে।');
  };

  const handleApproveProof = async (proofId: string) => {
    const prf = proofs.find(p => p.id === proofId);
    if (!prf || prf.status === 'approved') return;

    await adminUpdateFirestoreProofStatus(proofId, 'approved');

    if (prf.workerId) {
      const worker = users.find(u => u.id === prf.workerId);
      if (worker) {
        await adminAdjustFirestoreUserBalances(worker.id, {
          balance: Number(((worker.balance || 0) + prf.reward).toFixed(2))
        });
      }
      const tx: Transaction = {
        id: 'TX-PRF-' + Math.floor(1000 + Math.random() * 9000),
        type: 'micro_job',
        title: `প্রুফ অনুমোদিত: ${prf.jobTitle}`,
        amount: prf.reward,
        date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        status: 'completed'
      };
      await createFirestoreTransaction(tx, prf.workerId);
    }

    showToast(`প্রমাণ অনুমোদিত! ৳${prf.reward} ওয়ার্কার ওয়ালেটে পেইড`);
  };

  const handleRejectProof = async (proofId: string) => {
    await adminUpdateFirestoreProofStatus(proofId, 'rejected');
    showToast('প্রমাণটি প্রত্যাখ্যান করা হয়েছে');
  };

  const handleSubmitFeedback = async (newFb: FeedbackItem) => {
    if (!auth.currentUser) {
      setAuthModalOpen(true);
      showToast('মতামত বা অভিযোগ জমা দিতে আগে আপনার অ্যাকাউন্টে লগইন করুন!');
      return;
    }
    await createFirestoreFeedback(
      {
        ...newFb,
        userId: auth.currentUser.uid,
        userName: currentUser?.name || newFb.userName,
        userPhone: currentUser?.phone || currentUser?.email || newFb.userPhone
      },
      auth.currentUser.uid
    );
  };

  const handleReplyFeedback = async (feedbackId: string, reply: string) => {
    await adminReplyFirestoreFeedback(feedbackId, reply);
    showToast('অভিযোগের জবাব প্রদান করা হয়েছে এবং বিষয়টি সমাধান হিসেবে চিহ্নিত হয়েছে!');
  };

  // +50 COINS PER MATH / QUIZ / CAPTCHA & INSTANT 1,000 COINS -> ৳1.00 BDT CONVERSION
  const awardTaskCoins = async (coinsWon: number) => {
    if (auth.currentUser && currentUser) {
      await incrementFirestoreUserCoins(auth.currentUser.uid, coins);
    } else {
      setGuestCoins(prev => prev + coinsWon);
      setCoins(prev => prev + coinsWon);
    }
  };

  const handleConvertCoins = async () => {
    if (!auth.currentUser || !currentUser) {
      setAuthModalOpen(true);
      showToast('কয়েন মূল ওয়ালেটে কনভার্ট করতে আগে আপনার অ্যাকাউন্টে লগইন করুন!');
      return;
    }

    if (coins < 1000) {
      playSound('error');
      showToast('কনভার্ট করতে নূন্যতম ১,০০০ কয়েন প্রয়োজন!');
      return;
    }

    playSound('coin');
    await convertFirestoreUserCoins(auth.currentUser.uid, coins, balance);

    const newTx: Transaction = {
      id: 'TX-CNV-' + Math.floor(100000 + Math.random() * 900000),
      type: 'quiz_reward',
      title: 'কয়েন কনভার্ট (১,০০০ কয়েন = ৳১.০০ BDT)',
      amount: 1,
      date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      status: 'completed'
    };
    await createFirestoreTransaction(newTx, auth.currentUser.uid);
    showToast('অভিনন্দন! ১,০০০ কয়েন কেটে ৳১.০০ BDT মূল ওয়ালেটে যুক্ত হয়েছে!');
  };

  const handleSpinWin = async (entryCost: number, prizeWon: number) => {
    if (!auth.currentUser || !currentUser) {
      setSpinModalOpen(false);
      setAuthModalOpen(true);
      showToast('স্পিন গেম খেলতে আগে আপনার অ্যাকাউন্টে লগইন করুন!');
      return;
    }

    const nextBal = Math.max(0, Number((balance - entryCost + prizeWon).toFixed(2)));
    await updateFirestoreUserBalance(auth.currentUser.uid, nextBal);

    if (prizeWon > 0 || entryCost > 0) {
      const newTx: Transaction = {
        id: 'TX-SPIN-' + Math.floor(100000 + Math.random() * 900000),
        type: 'spin_game',
        title:
          prizeWon > 0
            ? `স্পিন & উইন পুরস্কার জয় (+৳${prizeWon})`
            : `স্পিন প্যাক ক্রয় (-৳${entryCost})`,
        amount: prizeWon > 0 ? prizeWon : entryCost,
        date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        status: 'completed'
      };
      await createFirestoreTransaction(newTx, auth.currentUser.uid);
    }
  };

  const handleMarkNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    playSound('click');
  };

  const handleSelectTab = (tab: AppTab) => {
    if (tab === 'analytics' && !currentUser) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      showToast('প্রাইভেট ড্যাশবোর্ড ও ওয়ালেট দেখতে আগে লগইন করুন!');
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route protection: redirect unauthenticated users away from private tabs back to home
  useEffect(() => {
    if (activeTab !== 'home' && !currentUser) {
      setActiveTab('home');
      setAuthModalMode('login');
      setAuthModalOpen(true);
      showToast('ড্যাশবোর্ড ও উপার্জনের ফিচার দেখতে আগে লগইন করুন!');
    }
  }, [activeTab, currentUser]);

  // User-isolated transactions (so members only see their own activities/earnings in History & Analytics)
  const userTransactions = currentUser
    ? transactions.filter(tx => !tx.userId || tx.userId === currentUser.id)
    : [];

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col antialiased overflow-x-hidden">
      {/* Blocked User Warning Alert */}
      {currentUser?.isBlocked && (
        <div className="bg-rose-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
          <span>
            ⚠️ আপনার একাউন্টটি এডমিন কর্তৃক স্থগিত (Blocked) রয়েছে। উইথড্রয়াল ও টাস্ক সাময়িকভাবে সীমিত।
          </span>
        </div>
      )}

      {/* Top Navigation with Separate Math Task & Quiz Job Buttons */}
      <Navbar
        balance={balance}
        coins={coins}
        pendingEscrowBalance={pendingEscrowBalance}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenMathTask={() => setMathModalOpen(true)}
        onOpenQuizJob={() => setQuizModalOpen(true)}
        onOpenCaptcha={() => setCaptchaModalOpen(true)}
        onOpenWallet={() => setWalletModalOpen(true)}
        onOpenAuth={() => {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }}
        onOpenRegister={() => {
          setAuthModalMode('signup');
          setAuthModalOpen(true);
        }}
        onOpenSideDrawer={() => setSideDrawerOpen(true)}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        currentUser={currentUser}
        language={language}
        onToggleLanguage={handleToggleLanguage}
      />

      {/* Main Content Area with safe Netlify badge clearance */}
      <main className="flex-1 pb-28 md:pb-20">
        {/* VIEW 1: HOMEPAGE */}
        {activeTab === 'home' && (
          <Hero
            coins={coins}
            balance={balance}
            onConvertCoins={handleConvertCoins}
            onStartEarning={() => handleSelectTab('resell')}
            onOpenCreateJob={() => setCreateJobModalOpen(true)}
            onOpenRules={() => setRulesModalOpen(true)}
            onSelectTab={handleSelectTab}
            onOpenMathTask={() => setMathModalOpen(true)}
            onOpenQuizJob={() => setQuizModalOpen(true)}
            onOpenCaptcha={() => setCaptchaModalOpen(true)}
            onOpenWallet={() => setWalletModalOpen(true)}
            onOpenSpinWin={() => setSpinModalOpen(true)}
            language={language}
            currentUser={currentUser}
            transactions={userTransactions}
            onClaimGiftReward={handleClaimGiftReward}
            onOpenLogin={() => {
              setAuthModalMode('login');
              setAuthModalOpen(true);
            }}
            onOpenRegister={() => {
              setAuthModalMode('signup');
              setAuthModalOpen(true);
            }}
            onShowToast={showToast}
          />
        )}

        {/* VIEW 2: RESELLING STORE (LIVE FIREBASE CATALOG) */}
        {activeTab === 'resell' && (
          <div className="py-6">
            <ProductsSection
              products={products}
              onSelectProductForOrder={prod => {
                if (!currentUser) {
                  setAuthModalOpen(true);
                  showToast('পণ্য অর্ডার করতে আগে আপনার অ্যাকাউন্টে লগইন করুন!');
                  return;
                }
                setSelectedProductForOrder(prod);
              }}
              onClose={() => handleSelectTab('home')}
              onShowToast={showToast}
              language={language}
            />
          </div>
        )}

        {/* VIEW 3: MICRO JOBS */}
        {activeTab === 'microjobs' && (
          <div className="py-6">
            <MicroJobsSection
              jobs={jobs}
              onCompleteJob={handleCompleteJob}
              onOpenCreateJob={() => setCreateJobModalOpen(true)}
              onClose={() => handleSelectTab('home')}
              onShowToast={showToast}
              language={language}
            />
          </div>
        )}

        {/* VIEW 4: WALLET & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="py-6">
            <DashboardAnalytics
              balance={balance}
              coins={coins}
              onConvertCoins={handleConvertCoins}
              transactions={userTransactions}
              onOpenWallet={() => setWalletModalOpen(true)}
              onClose={() => handleSelectTab('home')}
            />
          </div>
        )}

        {/* VIEW 5: SUPPORT & COMPLAINTS */}
        {activeTab === 'support' && (
          <div className="py-6">
            <SupportFeedbackSection
              currentUser={currentUser}
              feedbacks={feedbacks}
              onSubmitFeedback={handleSubmitFeedback}
              onShowToast={showToast}
              language={language}
              onClose={() => handleSelectTab('home')}
              onOpenAiChat={() => setSupportChatOpen(true)}
            />
          </div>
        )}

      </main>

      {/* Isolated Non-Incentivized AdSense Display Container */}
      <aside
        aria-label="Advertisement"
        data-adsense-safe-zone="footer-separated"
        className="max-w-5xl w-full mx-auto px-4 my-8 empty:hidden"
      />

      {/* Footer */}
      <Footer
        onOpenWallet={() => setWalletModalOpen(true)}
        onOpenRules={() => setRulesModalOpen(true)}
        onOpenSupport={() => setOfficialChannelOpen(true)}
        onOpenSecretAdmin={() => setSecretAdminModalOpen(true)}
        onOpenPolicyPage={page => setPolicyModalPage(page)}
        onOpenMathTask={() => setMathModalOpen(true)}
        onOpenQuizJob={() => setQuizModalOpen(true)}
        onOpenCaptcha={() => setCaptchaModalOpen(true)}
        onSelectTab={handleSelectTab}
        language={language}
      />

      {/* SIDE DRAWER MENU */}
      {sideDrawerOpen && (
        <SideDrawer
          isOpen={sideDrawerOpen}
          onClose={() => setSideDrawerOpen(false)}
          currentUser={currentUser}
          balance={balance}
          coins={coins}
          pendingEscrowBalance={pendingEscrowBalance}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenMathTask={() => setMathModalOpen(true)}
          onOpenQuizJob={() => setQuizModalOpen(true)}
          onOpenCaptcha={() => setCaptchaModalOpen(true)}
          onConvertCoins={handleConvertCoins}
          onOpenWallet={() => setWalletModalOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
          onOpenAuth={() => {
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }}
          onOpenCreateJob={() => setCreateJobModalOpen(true)}
          onOpenRules={() => setRulesModalOpen(true)}
          onOpenPolicyPage={page => setPolicyModalPage(page)}
          onOpenSpinWin={() => setSpinModalOpen(true)}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
          isMuted={isMuted}
          toggleMute={handleToggleMute}
          language={language}
        />
      )}

      {/* SEPARATE MODAL 1: MATH TASK */}
      {mathModalOpen && (
        <MathTaskModal
          isOpen={mathModalOpen}
          onClose={() => {
            setMathModalOpen(false);
            setActiveTab('home');
          }}
          coins={coins}
          balance={balance}
          onWinMathCoins={awardTaskCoins}
          onConvertCoins={handleConvertCoins}
          onShowToast={showToast}
          language={language}
        />
      )}

      {/* SEPARATE MODAL 2: QUIZ JOB */}
      {quizModalOpen && (
        <QuizJobModal
          isOpen={quizModalOpen}
          onClose={() => {
            setQuizModalOpen(false);
            setActiveTab('home');
          }}
          coins={coins}
          balance={balance}
          onWinQuizCoins={awardTaskCoins}
          onConvertCoins={handleConvertCoins}
          onShowToast={showToast}
          language={language}
          questions={quizQuestions}
          isLoading={quizLoading}
          error={quizError}
          onFetchQuestions={() => handleFetchQuizQuestions()}
          onConsumeQuestion={handleConsumeQuizQuestion}
        />
      )}

      {/* SEPARATE MODAL 3: CAPTCHA SOLVING */}
      {captchaModalOpen && (
        <CaptchaModal
          isOpen={captchaModalOpen}
          onClose={() => {
            setCaptchaModalOpen(false);
            setActiveTab('home');
          }}
          coins={coins}
          balance={balance}
          onWinCaptchaCoins={awardTaskCoins}
          onConvertCoins={handleConvertCoins}
          onShowToast={showToast}
          language={language}
        />
      )}

      {/* USER-GENERATED JOB POSTING MODAL */}
      {createJobModalOpen && (
        <CreateJobModal
          isOpen={createJobModalOpen}
          onClose={() => {
            setCreateJobModalOpen(false);
            setActiveTab('home');
          }}
          onSubmitJob={handleSubmitUserJob}
          language={language}
        />
      )}

      {/* STRICT SECRET ADMIN PIN MODAL */}
      {secretAdminModalOpen && (
        <SecretAdminModal
          isOpen={secretAdminModalOpen}
          onClose={() => {
            setSecretAdminModalOpen(false);
            setActiveTab('home');
          }}
          adminPin={adminPin}
          onPinUpdated={(newPin: string) => {
            setAdminPin(newPin);
            showToast('অ্যাডমিন মাস্টার পিন সফলভাবে আপডেট হয়েছে!');
          }}
          onAuthorized={(token: string) => {
            setAdminDeviceToken(token);
            setSecretAdminModalOpen(false);
            setAdminDashboardModalOpen(true);
            showToast('অ্যাডমিন প্যানেল অনুমোদিত হয়েছে!');
          }}
        />
      )}

      {/* SECRET ADMIN DASHBOARD */}
      {adminDashboardModalOpen && (
        <AdminDashboardModal
          isOpen={adminDashboardModalOpen}
          onClose={() => {
            setAdminDashboardModalOpen(false);
            setActiveTab('home');
          }}
          adminToken={adminDeviceToken}
          onRevokeAdminDevice={handleRevokeAdminDevice}
          users={users}
          onToggleBlockUser={handleToggleBlockUser}
          withdrawals={withdrawals}
          onApproveWithdrawal={handleApproveWithdrawal}
          onRejectWithdrawal={handleRejectWithdrawal}
          orders={orders}
          onApproveEscrowOrder={handleApproveEscrowOrder}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          jobs={jobs}
          onApproveUserJob={handleApproveUserJob}
          onRejectUserJob={handleRejectUserJob}
          onAdminCreateJob={handleAdminCreateJob}
          onAdminDeleteJob={handleAdminDeleteJob}
          proofs={proofs}
          onApproveProof={handleApproveProof}
          onRejectProof={handleRejectProof}
          feedbacks={feedbacks}
          onReplyFeedback={handleReplyFeedback}
          products={products}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          adminPin={adminPin}
          onUpdateAdminPin={handleUpdateMasterPin}
          language={language}
        />
      )}

      {/* RULES MODAL */}
      {rulesModalOpen && (
        <RulesModal
          isOpen={rulesModalOpen}
          onClose={() => {
            setRulesModalOpen(false);
            setActiveTab('home');
          }}
          language={language}
        />
      )}

      {/* DEDICATED GOOGLE ADSENSE COMPLIANCE & POLICY TRUST MODAL */}
      {policyModalPage && (
        <PolicyTrustModal
          activePage={policyModalPage}
          onSelectPage={page => setPolicyModalPage(page)}
          onClose={() => {
            setPolicyModalPage(null);
            setActiveTab('home');
          }}
          currentUser={currentUser}
          onSubmitFeedback={handleSubmitFeedback}
          onShowToast={showToast}
          language={language}
        />
      )}

      {/* RESELL ORDER CHECKOUT MODAL */}
      {selectedProductForOrder && (
        <OrderModal
          product={selectedProductForOrder}
          resellerName={currentUser?.name || 'রিসেলার মেম্বার'}
          onClose={() => {
            setSelectedProductForOrder(null);
            setActiveTab('home');
          }}
          onSubmitOrder={handleSubmitOrder}
        />
      )}

      {/* SECURE CASHOUT / WITHDRAWAL MODAL */}
      {walletModalOpen && (
        <WalletModal
          balance={balance}
          currentUser={currentUser}
          onClose={() => {
            setWalletModalOpen(false);
            setActiveTab('home');
          }}
          onWithdrawSuccess={handleWithdrawSuccess}
          language={language}
        />
      )}

      {/* USER PROFILE MODAL */}
      {profileModalOpen && (
        <UserProfileModal
          balance={balance}
          coins={coins}
          currentUser={currentUser}
          onConvertCoins={handleConvertCoins}
          onClose={() => {
            setProfileModalOpen(false);
            setActiveTab('home');
          }}
        />
      )}

      {/* SPIN-TO-WIN MODAL */}
      {spinModalOpen && (
        <SpinWinModal
          isOpen={spinModalOpen}
          onClose={() => {
            setSpinModalOpen(false);
            setActiveTab('home');
          }}
          balance={balance}
          onSpinWin={handleSpinWin}
          onShowToast={showToast}
          language={language}
        />
      )}

      {/* OFFICIAL COMMUNITY MODAL */}
      {officialChannelOpen && (
        <OfficialChannelModal
          onClose={() => {
            setOfficialChannelOpen(false);
            setActiveTab('home');
          }}
        />
      )}

      {/* FIREBASE AUTHENTICATION MODAL */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
          guestCoins={guestCoins}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          blockedNoticeUser={blockedNoticeUser}
          onClearBlockedNotice={() => setBlockedNoticeUser(null)}
          onSubmitBlockedComplaint={handleSubmitBlockedUserComplaint}
        />
      )}

      {/* TOAST NOTIFICATION */}
      <NotificationToast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />

      {/* AI CUSTOMER SUPPORT & BUSINESS ADVISOR CHATBOT WIDGET */}
      <SupportChatbotWidget
        language={language}
        currentUser={currentUser}
        activeTab={activeTab}
        balance={balance}
        coins={coins}
        pendingEscrowBalance={pendingEscrowBalance}
        activeJobsCount={jobs.length}
        publishedProductsCount={products.length}
        isOpenExternal={supportChatOpen}
        onOpenChange={setSupportChatOpen}
      />

      {/* MOBILE BOTTOM NAVIGATION BAR (Strictly hidden on public landing page; visible only after login) */}
      {currentUser && (
        <BottomNavBar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenMathTask={() => setMathModalOpen(true)}
          onOpenQuizJob={() => setQuizModalOpen(true)}
          onOpenCaptcha={() => setCaptchaModalOpen(true)}
          onOpenWallet={() => setWalletModalOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
          language={language}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
