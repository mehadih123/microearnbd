import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShoppingBag, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  DollarSign, 
  ShieldCheck, 
  Layers, 
  Users, 
  Clock, 
  Smartphone, 
  Search,
  AlertCircle,
  Lock,
  Unlock,
  ArrowUpRight,
  RotateCcw,
  MessageSquare,
  Send,
  Eye,
  Check,
  LayoutDashboard,
  UserCheck,
  UserX,
  Radio,
  FileText,
  AlertTriangle,
  KeyRound,
  LogOut,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Wallet,
  CheckCheck,
  Gift,
  Archive,
  Megaphone,
  Link2,
  Code2,
  ExternalLink
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Product, Order, MicroJob, TaskProofSubmission, Language, UserAccount, WithdrawalRequest, FeedbackItem, SupportMessageItem, GiftCode, AdsConfig } from '../types';
import { playSound } from '../utils/audio';
import {
  auth,
  isAuthorizedAdminUser,
  compressProductImage,
  cleanupOldUserAccounts,
  createFirestoreGiftCode,
  deleteFirestoreGiftCode,
  toggleFirestoreGiftCode,
  getAdminPinFromFirestore,
  DEFAULT_ADS_CONFIG,
  saveAdsConfigToFirestore,
  sanitizeExternalHttpUrl,
  db
} from '../firebase';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Admin device security
  adminToken?: string | null;
  onRevokeAdminDevice?: () => void;
  // User Management
  users: UserAccount[];
  onToggleBlockUser: (userId: string, reason?: string) => void;
  // Withdrawals Management
  withdrawals: WithdrawalRequest[];
  onApproveWithdrawal: (withdrawalId: string) => void;
  onRejectWithdrawal: (withdrawalId: string, reason: string) => void;
  // Resell Orders & Escrow
  orders: Order[];
  onApproveEscrowOrder: (orderId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  // User & Admin Micro Jobs
  jobs: MicroJob[];
  onApproveUserJob: (jobId: string) => void;
  onRejectUserJob: (jobId: string) => void;
  onAdminCreateJob?: (job: MicroJob) => Promise<void> | void;
  onAdminDeleteJob?: (jobId: string) => Promise<void> | void;
  onAdminClearAllJobs?: () => Promise<void> | void;
  // Worker Proofs
  proofs: TaskProofSubmission[];
  onApproveProof: (proofId: string) => void;
  onRejectProof: (proofId: string) => void;
  onArchiveProof?: (proofId: string, archived?: boolean) => Promise<void> | void;
  // Feedbacks & Complaints
  feedbacks: FeedbackItem[];
  onReplyFeedback: (feedbackId: string, reply: string) => void;
  // Direct Support Messages Inbox
  supportMessages?: SupportMessageItem[];
  onUpdateSupportMessageStatus?: (messageId: string, status: SupportMessageItem['status']) => Promise<void> | void;
  onDeleteSupportMessage?: (messageId: string) => Promise<void> | void;
  // Products Management
  products: Product[];
  onAddProduct: (product: Product) => Promise<void> | void;
  onUpdateProduct: (product: Product) => Promise<void> | void;
  onDeleteProduct: (productId: string) => Promise<void> | void;
  adminPin?: string;
  onUpdateAdminPin?: (newPin: string) => Promise<void> | void;
  adsConfig?: AdsConfig;
  onSaveAdsConfig?: (config: AdsConfig) => Promise<void> | void;
  language: Language;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  adminToken,
  onRevokeAdminDevice,
  users,
  onToggleBlockUser,
  withdrawals,
  onApproveWithdrawal,
  onRejectWithdrawal,
  orders,
  onApproveEscrowOrder,
  onUpdateOrderStatus,
  jobs,
  onApproveUserJob,
  onRejectUserJob,
  onAdminCreateJob,
  onAdminDeleteJob,
  onAdminClearAllJobs,
  proofs,
  onApproveProof,
  onRejectProof,
  onArchiveProof,
  feedbacks,
  onReplyFeedback,
  supportMessages = [],
  onUpdateSupportMessageStatus,
  onDeleteSupportMessage,
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  adminPin = '2026',
  onUpdateAdminPin,
  adsConfig = DEFAULT_ADS_CONFIG,
  onSaveAdsConfig,
  language
}) => {
  const isBn = language === 'bn';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'active_users' | 'blocked_users' | 'appeals' | 'complaints' | 'support_messages' | 'ads_manager' | 'withdrawals' | 'orders' | 'products' | 'jobs_proofs' | 'live_users' | 'gift_codes' | 'history_archive'>('dashboard');

  // Ads Manager (siteSettings/adsConfig) Form State
  const [adsEnabledDraft, setAdsEnabledDraft] = useState<boolean>(adsConfig.adsEnabled);
  const [smartLinkEnabledDraft, setSmartLinkEnabledDraft] = useState<boolean>(adsConfig.smartLinkEnabled);
  const [smartLinkUrlDraft, setSmartLinkUrlDraft] = useState<string>(adsConfig.smartLinkUrl);
  const [bannerEnabledDraft, setBannerEnabledDraft] = useState<boolean>(adsConfig.bannerEnabled);
  const [bannerCodeDraft, setBannerCodeDraft] = useState<string>(adsConfig.bannerCode);
  const [isSavingAds, setIsSavingAds] = useState<boolean>(false);
  const [adsNotice, setAdsNotice] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAdsEnabledDraft(Boolean(adsConfig.adsEnabled));
    setSmartLinkEnabledDraft(Boolean(adsConfig.smartLinkEnabled));
    setSmartLinkUrlDraft(adsConfig.smartLinkUrl || '');
    setBannerEnabledDraft(Boolean(adsConfig.bannerEnabled));
    setBannerCodeDraft(adsConfig.bannerCode || '');
  }, [isOpen, adsConfig]);

  const handleSaveAdsSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdsNotice(null);

    const trimmedUrl = smartLinkUrlDraft.trim();
    if (trimmedUrl && !sanitizeExternalHttpUrl(trimmedUrl)) {
      playSound('error');
      setAdsNotice({
        text: 'সঠিক Smart Link URL দিন (অবশ্যই https:// বা http:// দিয়ে শুরু হতে হবে)। / Please enter a valid Smart Link URL starting with http:// or https://.',
        isError: true
      });
      return;
    }

    const nextConfig: AdsConfig = {
      adsEnabled: adsEnabledDraft,
      smartLinkEnabled: smartLinkEnabledDraft,
      smartLinkUrl: trimmedUrl,
      bannerEnabled: bannerEnabledDraft,
      bannerCode: bannerCodeDraft.trim()
    };

    setIsSavingAds(true);
    try {
      if (onSaveAdsConfig) {
        await onSaveAdsConfig(nextConfig);
      } else {
        await saveAdsConfigToFirestore(nextConfig);
      }
      playSound('success');
      setAdsNotice({
        text: 'অ্যাড সেটিংস সফলভাবে Firebase-এ সেভ হয়েছে এবং লাইভ সাইটে আপডেট হয়েছে! / Ads settings saved to Firestore & updated live!',
        isError: false
      });
    } catch (err: unknown) {
      playSound('error');
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'অ্যাড সেটিংস সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন। / Failed to save ads settings.';
      setAdsNotice({ text: message, isError: true });
    } finally {
      setIsSavingAds(false);
    }
  };

  // Dynamic Gift Codes Management State
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeType, setNewCodeType] = useState<'coins' | 'balance'>('coins');
  const [newCodeAmount, setNewCodeAmount] = useState<string>('100');
  const [newCodeDesc, setNewCodeDesc] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('');
  const [isCreatingGiftCode, setIsCreatingGiftCode] = useState(false);
  const [giftCodeNotice, setGiftCodeNotice] = useState<string | null>(null);
  const [giftCodeError, setGiftCodeError] = useState<string | null>(null);
  const [confirmDeleteGiftId, setConfirmDeleteGiftId] = useState<string | null>(null);
  const [confirmClearAllJobs, setConfirmClearAllJobs] = useState(false);
  const [isClearingJobs, setIsClearingJobs] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'gift_codes'), snap => {
      const list: GiftCode[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          code: (data.code as string) || d.id,
          type: (data.type as 'coins' | 'balance') || 'coins',
          amount: Number(data.amount || 0),
          description: (data.description as string) || '',
          maxUses: typeof data.maxUses === 'number' ? data.maxUses : undefined,
          timesUsed: Number(data.timesUsed || 0),
          active: Boolean(data.active)
        };
      });
      setGiftCodes(list);
    }, () => {});
    return () => unsub();
  }, [isOpen]);

  // Search filters
  const [searchQuery, setSearchQuery] = useState('');
  const [liveUserSearch, setLiveUserSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'withdrawals' | 'proofs' | 'complaints' | 'appeals'>('all');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archivingProofId, setArchivingProofId] = useState<string | null>(null);

  // Admin Manual Micro-Task Form State (Strictly Empty Initial State — Zero Hardcoded Tasks)
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobCategory, setNewJobCategory] = useState<MicroJob['category']>('youtube');
  const [newJobTargetUrl, setNewJobTargetUrl] = useState('');
  const [newJobReward, setNewJobReward] = useState('');
  const [newJobSlots, setNewJobSlots] = useState('');
  const [newJobTime, setNewJobTime] = useState('');
  const [newJobInstructions, setNewJobInstructions] = useState('');
  const [newJobProofPlaceholder, setNewJobProofPlaceholder] = useState('');
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [adminJobNotice, setAdminJobNotice] = useState<string | null>(null);

  const handleCreateAdminMicroJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminJobNotice(null);
    if (!onAdminCreateJob) return;

    const cleanTitle = newJobTitle.trim();
    const rewardVal = Number(newJobReward);
    const slotsVal = Math.floor(Number(newJobSlots));

    if (!cleanTitle || !newJobTargetUrl.trim() || !rewardVal || rewardVal < 1 || !slotsVal || slotsVal < 1) {
      playSound('error');
      setAdminJobNotice('অনুগ্রহ করে টাস্কের নাম, লিংক, সঠিক রিওয়ার্ড (৳) এবং স্লট সংখ্যা দিন।');
      return;
    }

    const platformMap: Record<MicroJob['category'], string> = {
      youtube: 'YouTube',
      facebook: 'Facebook',
      telegram: 'Telegram',
      app: 'App Install',
      review: 'Review'
    };

    const parsedInstructions = newJobInstructions
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    setIsCreatingJob(true);
    try {
      const createdJob: MicroJob = {
        id: 'ADM-JOB-' + Date.now().toString(36).toUpperCase(),
        title: cleanTitle,
        category: newJobCategory,
        platform: platformMap[newJobCategory] || 'Social',
        reward: rewardVal,
        estimatedTime: newJobTime.trim() || '২ মিনিট',
        completedSlots: 0,
        totalSlots: slotsVal,
        instructions: parsedInstructions.length > 0 ? parsedInstructions : ['প্রদত্ত লিংকে গিয়ে নির্দেশনা অনুযায়ী কাজ সম্পন্ন করুন'],
        proofPlaceholder: newJobProofPlaceholder.trim() || 'কাজের স্ক্রিনশট লিংক বা ইউজারনেম লিখুন',
        targetUrl: newJobTargetUrl.trim(),
        isUserGenerated: false,
        status: 'active'
      };
      await onAdminCreateJob(createdJob);
      playSound('success');
      setNewJobTitle('');
      setNewJobTargetUrl('');
      setNewJobReward('');
      setNewJobSlots('');
      setNewJobTime('');
      setNewJobInstructions('');
      setNewJobProofPlaceholder('');
      setAdminJobNotice(`"${createdJob.title}" সফলভাবে লাইভ মাইক্রো-টাস্ক বোর্ডে যুক্ত হয়েছে!`);
    } catch {
      playSound('error');
      setAdminJobNotice('টাস্ক যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsCreatingJob(false);
    }
  };

  // Block Modal Confirmation State
  const [userToBlock, setUserToBlock] = useState<UserAccount | null>(null);
  const [blockReason, setBlockReason] = useState('সন্দেহজনক কার্যকলাপ ও পলিসি লঙ্ঘন');
  const [customBlockReason, setCustomBlockReason] = useState('');

  // Withdrawal Reject Modal state
  const [rejectingWdrId, setRejectingWdrId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('ভুল একাউন্ট নম্বর প্রদান করা হয়েছে');

  // Feedback Reply state
  const [replyingFbId, setReplyingFbId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Direct Support Messages Inbox state
  const [supportMsgFilter, setSupportMsgFilter] = useState<'all' | 'new' | 'read' | 'resolved'>('all');
  const [updatingSupportMsgId, setUpdatingSupportMsgId] = useState<string | null>(null);
  const [confirmDeleteSupportMsgId, setConfirmDeleteSupportMsgId] = useState<string | null>(null);

  // Direct Master PIN Change State (without insecure simulated OTP)
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Database Cleanup state
  const [isCleaningUsers, setIsCleaningUsers] = useState(false);
  const [confirmCleanupUsers, setConfirmCleanupUsers] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<string | null>(null);

  const handleCleanupOldUsers = async () => {
    setIsCleaningUsers(true);
    setCleanupReport(null);
    playSound('click');
    try {
      const res = await cleanupOldUserAccounts();
      playSound('success');
      setCleanupReport(`সফলভাবে ${res.deletedCount} টি পুরাতন ইউজার ডাটা ডিলিট হয়েছে (${res.preservedCount} টি এডমিন অ্যাকাউন্ট নিরাপদ রাখা হয়েছে)`);
    } catch {
      playSound('error');
      setCleanupReport('ক্লিনআপ সম্পন্ন হয়নি। পারমিশন চেক করুন।');
    } finally {
      setIsCleaningUsers(false);
      setConfirmCleanupUsers(false);
    }
  };

  const handleDirectUpdateMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = newPinInput.trim();
    if (cleanNew.length < 4 || cleanNew.length > 16) {
      setPinMessage({ text: 'নতুন পিন ৪ থেকে ১৬ সংখ্যার হতে হবে!', isError: true });
      playSound('error');
      return;
    }
    if (cleanNew !== confirmPinInput.trim()) {
      setPinMessage({ text: 'নতুন পিন ও কনফার্ম পিন মেলেনি!', isError: true });
      playSound('error');
      return;
    }

    setIsUpdatingPin(true);
    try {
      let storedPin = (adminPin || '2026').trim();
      try {
        const remotePin = await getAdminPinFromFirestore();
        if (remotePin && remotePin.trim()) {
          storedPin = remotePin.trim();
        }
      } catch {
        // Fallback to prop state if offline
      }

      if (currentPinInput.trim() !== storedPin) {
        setPinMessage({ text: 'বর্তমান মাস্টার পিন সঠিক নয়! পুনরায় চেষ্টা করুন।', isError: true });
        playSound('error');
        return;
      }

      if (onUpdateAdminPin) {
        await onUpdateAdminPin(cleanNew);
      }
      setPinMessage({ text: 'অ্যাডমিন মাস্টার পিন সফলভাবে ক্লাউডে আপডেট করা হয়েছে!', isError: false });
      playSound('success');
      setTimeout(() => {
        setShowPinModal(false);
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setPinMessage(null);
      }, 1500);
    } catch {
      setPinMessage({ text: 'পিন আপডেট করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।', isError: true });
      playSound('error');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  // Gift Code Handlers
  const handleCreateGiftCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGiftCodeNotice(null);
    setGiftCodeError(null);
    const cleanCode = newCodeName.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode || cleanCode.length < 2) {
      setGiftCodeError('গিফট কোড কমপক্ষে ২ অক্ষরের হতে হবে (যেমন: BONUS100)!');
      playSound('error');
      return;
    }
    const parsedCodeAmount = Number(newCodeAmount);
    if (!newCodeAmount.trim() || !Number.isFinite(parsedCodeAmount) || parsedCodeAmount <= 0) {
      setGiftCodeError('রিওয়ার্ড অ্যামাউন্ট ১ এর বেশি হতে হবে!');
      playSound('error');
      return;
    }

    setIsCreatingGiftCode(true);
    try {
      await createFirestoreGiftCode({
        code: cleanCode,
        type: newCodeType,
        amount: parsedCodeAmount,
        description: newCodeDesc.trim() || (newCodeType === 'coins' ? `${parsedCodeAmount} কয়েন বোনাস` : `৳${parsedCodeAmount} নগদ ক্যাশ ওয়ালেট বোনাস`),
        maxUses: newCodeMaxUses ? parseInt(newCodeMaxUses, 10) : undefined
      });
      playSound('success');
      setGiftCodeNotice(`নতুন গিফট কোড "${cleanCode}" সফলভাবে তৈরি হয়েছে এবং লাইভ সক্রিয় হয়েছে!`);
      setNewCodeName('');
      setNewCodeAmount('100');
      setNewCodeDesc('');
      setNewCodeMaxUses('');
    } catch (err: unknown) {
      playSound('error');
      setGiftCodeError((err as Error)?.message || 'কোড তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsCreatingGiftCode(false);
    }
  };

  const handleToggleGiftCodeStatus = async (id: string, currentActive: boolean) => {
    setGiftCodeError(null);
    playSound('click');
    try {
      await toggleFirestoreGiftCode(id, !currentActive);
    } catch {
      setGiftCodeError('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
      playSound('error');
    }
  };

  const handleDeleteGiftCode = async (id: string) => {
    setGiftCodeError(null);
    playSound('click');
    try {
      await deleteFirestoreGiftCode(id);
      playSound('success');
      setGiftCodeNotice(`গিফট কোড "${id}" স্থায়ীভাবে মুছে ফেলা হয়েছে।`);
    } catch {
      setGiftCodeError('গিফট কোড ডিলিট করতে সমস্যা হয়েছে');
      playSound('error');
    } finally {
      setConfirmDeleteGiftId(null);
    }
  };

  // Product Add / Edit Form State (numeric inputs stored as strings so clearing never forces "0")
  const adminModalScrollRef = useRef<HTMLDivElement>(null);
  const productFormRef = useRef<HTMLFormElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodTitleEn, setProdTitleEn] = useState('');
  const [prodCategory, setProdCategory] = useState<string>('medicine');
  const [customerPrice, setCustomerPrice] = useState<string>('500');
  const [commission, setCommission] = useState<string>('150');
  const [deliveryInside, setDeliveryInside] = useState<string>('60');
  const [deliveryOutside, setDeliveryOutside] = useState<string>('120');
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [prodError, setProdError] = useState('');
  const [prodSuccess, setProdSuccess] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [features, setFeatures] = useState('অরিজিনাল ও অথেনটিক,ক্যাশ অন ডেলিভারি');

  // Smoothly scroll to the top of the Product Edit / Add Form whenever Edit Mode opens or switches product
  useEffect(() => {
    if (activeTab === 'products' && isEditingProduct && editingProdId) {
      const timer = setTimeout(() => {
        productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isEditingProduct, editingProdId]);

  // Reliable Gallery / File Image Picker with compression & error feedback
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    setProdError('');
    setProdSuccess('');

    if (!file.type.startsWith('image/')) {
      setProdError('শুধুমাত্র ছবি ফাইল (JPG, PNG, WEBP) নির্বাচন করুন।');
      playSound('error');
      inputEl.value = '';
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setProdError('ছবির ফাইল সাইজ ১২ মেগাবাইটের কম হতে হবে। অনুগ্রহ করে অপেক্ষাকৃত ছোট ছবি দিন।');
      playSound('error');
      inputEl.value = '';
      return;
    }

    setIsProcessingImage(true);
    try {
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
            resolve(reader.result);
          } else {
            reject(new Error('INVALID_IMAGE_DATA'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('STORAGE_PERMISSION_ERROR'));
        reader.readAsDataURL(file);
      });

      const compressed = await compressProductImage(rawDataUrl);
      if (!compressed || compressed.length > 180000) {
        throw new Error('IMAGE_TOO_LARGE');
      }

      setImage(compressed);
      setImagePreview(compressed);
      playSound('click');
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'IMAGE_TOO_LARGE') {
        setProdError('ছবিটি কমপ্রেস করার পরও নির্ধারিত সীমার চেয়ে বড়! অনুগ্রহ করে ছোট ছবি বা ইমেজ URL দিন।');
      } else {
        setProdError('ব্রাউজার গ্যালারি বা ফাইল স্টোরেজ অ্যাক্সেস করতে পারেনি। ফাইল পারমিশন দিয়ে আবার চেষ্টা করুন অথবা নিচে ইমেজ ওয়েব লিংক (URL) দিন।');
      }
      playSound('error');
    } finally {
      setIsProcessingImage(false);
      inputEl.value = '';
    }
  };

  // User counts and lists (Active Pending vs Archived Separation)
  const activeUsers = users.filter(u => !u.isBlocked);
  const blockedUsers = users.filter(u => u.isBlocked);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const processedWithdrawals = withdrawals.filter(w => w.status === 'approved' || w.status === 'rejected');
  const pendingUserJobs = jobs.filter(j => j.status === 'pending_admin_approval');
  const activeProofs = proofs.filter(p => !p.archived);
  const archivedProofs = proofs.filter(p => Boolean(p.archived));
  const pendingProofs = activeProofs.filter(p => p.status === 'pending');
  const pendingEscrowOrders = orders.filter(o => o.status === 'pending_courier' || !o.escrowReleased);
  const pendingAppeals = feedbacks.filter(f => f.category === 'blocked_account_appeal' && f.status !== 'resolved');
  const resolvedAppeals = feedbacks.filter(f => f.category === 'blocked_account_appeal' && f.status === 'resolved');
  const pendingComplaints = feedbacks.filter(f => f.category !== 'blocked_account_appeal' && f.status !== 'resolved');
  const resolvedComplaints = feedbacks.filter(f => f.category !== 'blocked_account_appeal' && f.status === 'resolved');
  const newSupportMessagesCount = supportMessages.filter(m => m.status === 'new').length;
  const totalArchivedCount = processedWithdrawals.length + archivedProofs.length + resolvedAppeals.length + resolvedComplaints.length;

  const totalPlatformBalance = users.reduce((acc, u) => acc + (u.balance || 0), 0);
  const totalEscrowBalance = users.reduce((acc, u) => acc + (u.pendingEscrowBalance || 0), 0);

  const renderUserReferralAnalytics = () => (
    <div className="mt-6 pt-6 border-t-2 border-slate-800 space-y-4">
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white">
                ইউজার রেফারেল ট্র্যাকিং বার ও মেম্বার অ্যানালিটিক্স
              </h3>
              <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                লাইভ ট্র্যাকিং
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              কোন মেম্বার কতজনকে সফলভাবে রেফার করেছে তার স্পষ্ট তালিকা, কাউন্ট ও লাইভ হিসাব
            </p>
          </div>
        </div>

        {/* Quick Summary Metrics */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center">
            <div className="text-[10px] text-slate-400">মোট রেফারেল সংখ্যা</div>
            <div className="text-sm font-black text-amber-400 font-mono">
              {users.reduce((acc, u) => acc + (u.referralsCount || 0), 0)} জন
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center">
            <div className="text-[10px] text-slate-400">সক্রিয় রেফারার</div>
            <div className="text-sm font-black text-emerald-400 font-mono">
              {users.filter(u => (u.referralsCount || 0) > 0).length} জন
            </div>
          </div>
        </div>
      </div>

      {/* Referral Table / List */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/60">
          <span className="text-xs font-bold text-slate-200">
            সকল মেম্বারদের রেফারেল পরিসংখ্যান (সর্বোচ্চ রেফারেল ক্রমানুসারে)
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            মোট মেম্বার: {users.length} জন
          </span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold sticky top-0 border-b border-slate-800">
              <tr>
                <th className="p-3">ইউজার নাম</th>
                <th className="p-3">মোবাইল / যোগাযোগ</th>
                <th className="p-3">ইউনিক রেফারেল কোড</th>
                <th className="p-3">সফল রেফারেল সংখ্যা</th>
                <th className="p-3">ব্যালেন্স</th>
                <th className="p-3">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    কোনো ইউজার তথ্য পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                [...users]
                  .sort((a, b) => (b.referralsCount || 0) - (a.referralsCount || 0))
                  .map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/60 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white text-xs">{u.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">{u.id}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-300 text-xs">
                        {u.phone || u.email || '—'}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-mono text-[11px] font-bold text-amber-400 border border-slate-700">
                          {u.referralCode || u.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-black font-mono inline-flex items-center gap-1.5 ${
                          (u.referralsCount || 0) > 0
                            ? 'bg-amber-950 text-amber-300 border border-amber-600/60 shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                        }`}>
                          <span>👥</span>
                          <span>{u.referralsCount || 0} জন রেফার করেছে</span>
                        </span>
                      </td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">
                        ৳{u.balance?.toFixed(2) || '0.00'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isBlocked
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {u.isBlocked ? 'ব্লকড' : 'সক্রিয়'}
                        </span>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const handleEditProductClick = (p: Product) => {
    playSound('click');
    setProdError('');
    setProdSuccess('');
    setEditingProdId(p.id);
    setProdTitle(p.title);
    setProdTitleEn(p.titleEn || p.title);
    setProdCategory(p.category || 'medicine');
    setCustomerPrice(p.customerPrice !== undefined ? String(p.customerPrice) : '');
    setCommission(p.commission !== undefined ? String(p.commission) : '');
    setDeliveryInside(String(p.deliveryChargeInside ?? 60));
    setDeliveryOutside(String(p.deliveryChargeOutside ?? 120));
    setImage(p.image);
    setImagePreview(p.image);
    setFeatures(p.features.join(', '));
    setIsEditingProduct(true);
    setTimeout(() => {
      if (productFormRef.current) {
        productFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      adminModalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError('');
    setProdSuccess('');

    if (!prodTitle.trim()) {
      playSound('error');
      setProdError('অনুগ্রহ করে পণ্যের বাংলা নাম লিখুন!');
      return;
    }

    const parsedPrice = Number(customerPrice);
    const parsedCommission = Number(commission);
    const parsedDeliveryInside = Number(deliveryInside);
    const parsedDeliveryOutside = Number(deliveryOutside);

    if (!customerPrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 1) {
      playSound('error');
      setProdError('সঠিক কাস্টমার বিক্রয় মূল্য (কমপক্ষে ৳১) লিখুন!');
      return;
    }
    if (!commission.trim() || !Number.isFinite(parsedCommission) || parsedCommission < 0) {
      playSound('error');
      setProdError('সঠিক রিসেলার কমিশন (৳০ বা তার বেশি) লিখুন!');
      return;
    }
    if (!deliveryInside.trim() || !Number.isFinite(parsedDeliveryInside) || parsedDeliveryInside < 0) {
      playSound('error');
      setProdError('সঠিক ঢাকার ভেতরের ডেলিভারি চার্জ লিখুন!');
      return;
    }
    if (!deliveryOutside.trim() || !Number.isFinite(parsedDeliveryOutside) || parsedDeliveryOutside < 0) {
      playSound('error');
      setProdError('সঠিক ঢাকার বাইরের ডেলিভারি চার্জ লিখুন!');
      return;
    }

    if (!image.trim()) {
      playSound('error');
      setProdError('অনুগ্রহ করে পণ্যের ছবি আপলোড করুন বা ইমেজ লিংক দিন!');
      return;
    }

    setIsSavingProduct(true);
    const savedTitle = prodTitle.trim();
    const isUpdate = Boolean(editingProdId);

    try {
      if (editingProdId) {
        const existing = products.find(p => p.id === editingProdId);
        if (!existing) {
          throw new Error('PRODUCT_NOT_FOUND');
        }
        await onUpdateProduct({
          ...existing,
          title: savedTitle,
          titleEn: prodTitleEn.trim() || savedTitle,
          category: prodCategory,
          customerPrice: parsedPrice,
          commission: parsedCommission,
          deliveryChargeInside: parsedDeliveryInside,
          deliveryChargeOutside: parsedDeliveryOutside,
          image: image.trim(),
          features: features.split(',').map(f => f.trim()).filter(Boolean)
        });
      } else {
        const newP: Product = {
          id: 'prod-' + Date.now(),
          title: savedTitle,
          titleEn: prodTitleEn.trim() || savedTitle,
          category: prodCategory,
          customerPrice: parsedPrice,
          commission: parsedCommission,
          deliveryChargeInside: parsedDeliveryInside,
          deliveryChargeOutside: parsedDeliveryOutside,
          image: image.trim(),
          rating: 4.9,
          soldCount: 0,
          supplier: 'MicroEarn Direct',
          description: 'অফিসিয়াল হোলসেল প্রোডাক্ট। ক্যাশ অন ডেলিভারি সুবিধা ও জিরো রিস্কে কমিশন।',
          features: features.split(',').map(f => f.trim()).filter(Boolean)
        };
        await onAddProduct(newP);
      }

      playSound('success');
      setProdSuccess(
        isUpdate
          ? `পণ্য "${savedTitle}" সফলভাবে Firebase-এ আপডেট হয়েছে ও প্রোডাক্ট লিস্টে রিফ্রেশ হয়েছে!`
          : `নতুন পণ্য "${savedTitle}" সফলভাবে Firebase স্টোরে পাবলিশ হয়েছে!`
      );
      setIsEditingProduct(false);
      setEditingProdId(null);
      setProdTitle('');
      setProdTitleEn('');
      setCustomerPrice('500');
      setCommission('150');
      setDeliveryInside('60');
      setDeliveryOutside('120');
      setImage('');
      setImagePreview('');
    } catch (err: unknown) {
      playSound('error');
      const msg = err instanceof Error ? err.message : '';
      setProdError(
        msg && !msg.startsWith('{')
          ? msg
          : 'Firebase-এ পণ্য সেভ/আপডেট করতে সমস্যা হয়েছে! অনুগ্রহ করে ইন্টারনেট এবং অ্যাডমিন জিমেইল সেশন যাচাই করে আবার চেষ্টা করুন।'
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleConfirmRejectWithdrawal = (id: string) => {
    playSound('error');
    onRejectWithdrawal(id, rejectReason);
    setRejectingWdrId(null);
    setRejectReason('ভুল একাউন্ট নম্বর প্রদান করা হয়েছে');
  };

  const handleConfirmFeedbackReply = (id: string) => {
    if (!replyText.trim()) return;
    playSound('success');
    onReplyFeedback(id, replyText);
    setReplyingFbId(null);
    setReplyText('');
  };

  const handleExecuteBlock = () => {
    if (!userToBlock) return;
    const finalReason = customBlockReason.trim() || blockReason;
    playSound('error');
    onToggleBlockUser(userToBlock.id, finalReason);
    setUserToBlock(null);
    setCustomBlockReason('');
  };

  if (!isOpen || !isAuthorizedAdminUser(auth.currentUser)) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-2 sm:px-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative my-auto w-full max-w-6xl max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex flex-col bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden">
        
        {/* Clean Admin Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/80 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-purple-900/30 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                MicroEarn BD — অ্যাডমিন প্যানেল
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                ইউজার, উইথড্রয়াল, অভিযোগ ও অর্ডার ব্যবস্থাপনা
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { playSound('click'); onClose(); }}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-rose-600 text-white border-2 border-slate-600 hover:border-rose-500 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
            aria-label="Close Admin Modal"
            title="বন্ধ করুন (×)"
          >
            &times;
          </button>
        </div>

        {/* Content Area */}
        <div ref={adminModalScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Mandatory Sub-View Top Action Strip with Instant Home Close (×) Button */}
          {activeTab !== 'dashboard' && (
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <button
                type="button"
                onClick={() => { playSound('click'); setActiveTab('dashboard'); }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>← অ্যাডমিন ওভারভিউ</span>
              </button>

              <button
                type="button"
                onClick={() => { playSound('click'); onClose(); }}
                className="w-9 h-9 rounded-xl bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-700/70 font-black text-xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                aria-label="হোম ড্যাশবোর্ডে ফিরে যান"
                title="হোমে ফিরে যান (×)"
              >
                &times;
              </button>
            </div>
          )}
          
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">

              {/* Real-time Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>মোট ইউজার</span>
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{users.length} জন</div>
                  <div className="text-[11px] text-slate-400">রিয়েল-টাইম রেজিস্টার্ড</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>সক্রিয় মেম্বার</span>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400">{activeUsers.length} জন</div>
                  <div className="text-[11px] text-emerald-500 font-medium">স্বাভাবিক প্রবেশাধিকার আছে</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>ব্লকড অ্যাকাউন্ট</span>
                    <UserX className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-400">{blockedUsers.length} জন</div>
                  <div className="text-[11px] text-rose-400 font-medium">সেশন ও লগইন স্থগিত</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>মোট ইউজার ব্যালেন্স</span>
                    <Wallet className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-2xl font-black text-teal-300">
                    ৳{totalPlatformBalance.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-400 font-medium">
                    এস্ক্রো: ৳{totalEscrowBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* VERTICALLY STACKED FULL-WIDTH ADMIN ACTION CONTROLS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    মাস্টার কন্ট্রোল ও ব্যবস্থাপনা (Admin Management Actions)
                  </h4>
                  <span className="text-[11px] text-purple-400 font-medium">১৩টি প্রধান বিভাগ</span>
                </div>

                <div className="flex flex-col w-full space-y-2.5">
                  
                  {/* 1. Live Users & Search Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('live_users'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-amber-950/80 border border-amber-700/60 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors">
                            ১. লাইভ ইউজার তালিকা ও সার্চ (Live Users & Search)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                            সার্চ বক্স
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          সরাসরি Gmail বা মোবাইল নম্বর সার্চ করে যেকোনো মেম্বারকে সবার শীর্ষে এনে লাইভ ব্যালেন্স ও স্ট্যাটাস যাচাই
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-amber-950 border border-amber-800 text-amber-300 text-xs font-bold font-mono">
                        {users.length} জন মেম্বার
                      </span>
                      <span className="text-slate-500 group-hover:text-amber-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 2. Withdrawal Requests Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('withdrawals'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-pink-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-pink-950/80 border border-pink-700/60 text-pink-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-pink-300 transition-colors">
                            ২. উইথড্রয়াল রিকোয়েস্ট (Pending Withdrawals)
                          </h4>
                          {pendingWithdrawals.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-pink-500 text-white font-bold animate-pulse">
                              নতুন {pendingWithdrawals.length} টি
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          পেন্ডিং বিকাশ, নগদ ও রকেট ক্যাশআউট অনুমোদন বা রিজেক্ট করুন (প্রসেসকৃতগুলো আর্কাইভে যাবে)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-pink-950 border border-pink-800 text-pink-300 text-xs font-bold font-mono">
                        {pendingWithdrawals.length} টি পেন্ডিং
                      </span>
                      <span className="text-slate-500 group-hover:text-pink-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 3. Blocked User Appeals Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('appeals'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-rose-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-rose-950/80 border border-rose-700/60 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-rose-300 transition-colors">
                            ৩. ব্লকড ইউজার আপিল (Blocked User Appeals)
                          </h4>
                          {pendingAppeals.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-bold animate-pulse">
                              {pendingAppeals.length} টি অপেক্ষমাণ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          স্থগিত অ্যাকাউন্টধারী মেম্বারদের চলমান আপিল আবেদনসমূহ ও ১-ক্লিকে তাৎক্ষণিক আনব্লক ব্যবস্থা
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold font-mono">
                        {pendingAppeals.length} টি আবেদন
                      </span>
                      <span className="text-slate-500 group-hover:text-rose-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 4. Complaints & Suggestions Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('complaints'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-teal-950/80 border border-teal-700/60 text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-teal-300 transition-colors">
                            ৪. অভিযোগ ও পরামর্শ (Pending Complaints)
                          </h4>
                          {pendingComplaints.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-600 text-white font-bold">
                              {pendingComplaints.length} টি পেন্ডিং
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          অমীমাংসিত অভিযোগ, মতামত ও পরামর্শ ইনবক্স (সমাধান করার পর স্বয়ংক্রিয়ভাবে আর্কাইভে চলে যাবে)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-teal-950 border border-teal-800 text-teal-300 text-xs font-bold font-mono">
                        {pendingComplaints.length} টি পেন্ডিং
                      </span>
                      <span className="text-slate-500 group-hover:text-teal-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 5. Product Upload Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('products'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-teal-950/80 border border-teal-700/60 text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-teal-300 transition-colors">
                            ৫. প্রোডাক্ট আপলোড ও ক্যাটালগ (Product Upload)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ছবি আপলোড, ক্যাটাগরি ও ঢাকার ভেতর/বাইরে ডেলিভারি চার্জ এবং কমিশন নির্ধারণ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-teal-950 border border-teal-800 text-teal-300 text-xs font-bold font-mono">
                        {products.length} টি পণ্য লাইভ
                      </span>
                      <span className="text-slate-500 group-hover:text-teal-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 6. Resell Orders Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('orders'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-indigo-300 transition-colors">
                            ৬. রিসেল অর্ডার ও স্মার্ট এস্ক্রো (Orders & Escrow)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          কাস্টমার ডেলিভারি স্ট্যাটাস ট্র্যাকিং ও ডেলিভারি সম্পন্ন হলে রিসেলার কমিশন রিলিজ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-bold font-mono">
                        {orders.length} টি অর্ডার
                      </span>
                      <span className="text-slate-500 group-hover:text-indigo-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 7. Micro-Tasks & Worker Proofs Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('jobs_proofs'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-blue-950/80 border border-blue-700/60 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-blue-300 transition-colors">
                            ৭. মাইক্রো-টাস্ক ও প্রুফ রিভিউ (Micro-Tasks &amp; Proofs)
                          </h4>
                          {pendingProofs.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-bold animate-pulse">
                              {pendingProofs.length} টি প্রুফ পেন্ডিং
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          নতুন মাইক্রো-টাস্ক তৈরি, ইউজার প্রুফ সাবমিশন যাচাই, রিওয়ার্ড অনুমোদন ও আর্কাইভ ব্যবস্থাপনা
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-300 text-xs font-bold font-mono">
                        {jobs.length} টি টাস্ক • {activeProofs.length} প্রুফ
                      </span>
                      <span className="text-slate-500 group-hover:text-blue-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 8. Blocked Users Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('blocked_users'); }}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-rose-500/50 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-rose-950/80 border border-rose-700/60 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <UserX className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-rose-300 transition-colors">
                            ৮. ব্লকড ইউজার তালিকা (Blocked Users)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          স্থগিত অ্যাকাউন্টসমূহ, ব্লকের কারণ পর্যালোচনা ও সেশন আনব্লক নিয়ন্ত্রণ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold font-mono">
                        {blockedUsers.length} জন স্থগিত
                      </span>
                      <span className="text-slate-500 group-hover:text-rose-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 9. Dynamic Gift Code Management Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('gift_codes'); }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-slate-800/90 to-slate-800/80 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors">
                            ৯. ডাইনামিক গিফট কোড ও প্রোমো ম্যানেজমেন্ট (Gift Codes)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                            Firebase Live
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          কাস্টম প্রোমো কোড তৈরি, কয়েন/নগদ টাকা রিওয়ার্ড ও ব্যবহারের সীমা (যেমন: ৫০০/১০০০ জন) নির্ধারণ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-amber-950 border border-amber-700 text-amber-300 text-xs font-bold font-mono">
                        {giftCodes.filter(g => g.active).length} টি সক্রিয়
                      </span>
                      <span className="text-slate-500 group-hover:text-amber-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 10. History & Archive Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('history_archive'); }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-800/90 to-slate-800/80 hover:bg-slate-800 border border-cyan-500/40 hover:border-cyan-400 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-cyan-950/80 border border-cyan-600/60 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Archive className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-cyan-300 transition-colors">
                            ১০. হিস্ট্রি ও আর্কাইভ (Processed History & Archive)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          অনুমোদিত/বাতিল উইথড্রয়াল এবং সমাধানকৃত অভিযোগ ও আপিলের স্থায়ী রেকর্ড আর্কাইভ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-bold font-mono">
                        {totalArchivedCount} টি আর্কাইভ
                      </span>
                      <span className="text-slate-500 group-hover:text-cyan-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 11. Prominent Master PIN / Password Change Card right on Primary Admin Control Screen */}
                  <button
                    onClick={() => { playSound('click'); setShowPinModal(true); }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-800/90 to-orange-950/30 hover:bg-slate-800 border border-amber-500/50 hover:border-amber-400 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors">
                            ১১. অ্যাডমিন মাস্টার পিন / পাসওয়ার্ড পরিবর্তন (Security PIN)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                            প্রধান সেটিংস
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          সরাসরি অ্যাডমিন প্যানেলের সিক্রেট মাস্টার পিন পরিবর্তন করে Firebase ক্লাউডে সংরক্ষণ করুন
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black">
                        পিন বদলান
                      </span>
                      <span className="text-slate-500 group-hover:text-amber-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 12. Direct Support Messages Inbox Card */}
                  <button
                    onClick={() => { playSound('click'); setActiveTab('support_messages'); }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-800/90 to-teal-950/40 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors">
                            ১২. সরাসরি সাপোর্ট মেসেজ (Support Messages)
                          </h4>
                          {newSupportMessagesCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-black animate-pulse">
                              নতুন {newSupportMessagesCount} টি
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          যোগাযোগ ও সহায়তা ফর্ম থেকে আসা ইউজার মেসেজ পড়ুন, পঠিত/সমাধানকৃত চিহ্নিত করুন বা ডিলিট করুন
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-bold font-mono">
                        {supportMessages.length} টি মেসেজ
                      </span>
                      <span className="text-slate-500 group-hover:text-emerald-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                  {/* 13. Ads Manager Card */}
                  <button
                    onClick={() => {
                      playSound('click');
                      setAdsNotice(null);
                      setActiveTab('ads_manager');
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-violet-950/50 via-slate-800/90 to-fuchsia-950/40 hover:bg-slate-800 border border-violet-500/40 hover:border-violet-400 text-left transition-all cursor-pointer group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-500/50 text-violet-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm sm:text-base text-white group-hover:text-violet-300 transition-colors">
                            ১৩. অ্যাড ম্যানেজমেন্ট (Ads Manager)
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              adsConfig.adsEnabled
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {adsConfig.adsEnabled ? 'LIVE • চালু' : 'OFF • বন্ধ'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Smart Link, Native Banner ও HTML/Script অ্যাড কোড লাইভ কন্ট্রোল ও নিরাপদ প্লেসমেন্ট ম্যানেজ করুন
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-violet-950 border border-violet-700 text-violet-300 text-xs font-bold font-mono">
                        {adsConfig.adsEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <span className="text-slate-500 group-hover:text-violet-400 text-lg transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </button>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ACTIVE / UNBLOCKED USERS LIST (REQUIREMENT 4A) */}
          {activeTab === 'active_users' && (
            <div className="space-y-4">
              
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>সক্রিয় ইউজার তালিকা ({activeUsers.length} জন)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    যেকোনো ইউজারকে "ব্লক করুন" ক্লিক করলে তার সেশন তাৎক্ষণিকভাবে বন্ধ (Auto-Logout) হয়ে যাবে
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-emerald-500 w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Database Cleanup Banner (Requirement 3: Delete Old User Accounts) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-red-950/30 to-slate-900 border border-rose-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-xs sm:text-sm text-white">Firebase ডেটাবেস ইউজার ক্লিনআপ (Old User Accounts Cleanup)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      নিরাপদ মুছুন
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    পূর্ববর্তী সকল রেজিস্টার্ড টেস্ট/পুরাতন সাধারণ ইউজার প্রোফাইল এবং PII ডকুমেন্ট মুছে ফেলুন। মূল সুপার-এডমিন (<span className="text-amber-300 font-mono font-bold">mdmehadih181@gmail.com</span>) এবং সিস্টেম কনফিগ ১০০% সুরক্ষিত থাকবে।
                  </p>
                  {cleanupReport && (
                    <div className="mt-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{cleanupReport}</span>
                    </div>
                  )}
                </div>

                {confirmCleanupUsers ? (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-rose-300">নিশ্চিত? এডমিন বাদে সব মেম্বার মুছে যাবে:</span>
                    <button
                      type="button"
                      onClick={handleCleanupOldUsers}
                      disabled={isCleaningUsers}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-all"
                    >
                      {isCleaningUsers ? 'ক্লিনআপ হচ্ছে...' : 'হ্যাঁ, সব মুছুন'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCleanupUsers(false)}
                      disabled={isCleaningUsers}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-all"
                    >
                      বাতিল
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { playSound('click'); setConfirmCleanupUsers(true); }}
                    disabled={isCleaningUsers}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 shrink-0 cursor-pointer transition-all"
                    title="পুরোনো টেস্ট ইউজার অ্যাকাউন্টগুলো ফায়ারবেস থেকে মুছে দিন"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isCleaningUsers ? 'ক্লিনআপ হচ্ছে...' : 'পুরাতন ইউজার ডাটা ডিলিট করুন'}</span>
                  </button>
                )}
              </div>

              {activeUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl">
                  কোনো সক্রিয় ইউজার পাওয়া যায়নি
                </div>
              ) : (
                <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-700">
                        <tr>
                          <th className="p-3.5">ইউজার তথ্য</th>
                          <th className="p-3.5">মোবাইল নম্বর</th>
                          <th className="p-3.5">ব্যালেন্স</th>
                          <th className="p-3.5">এস্ক্রো</th>
                          <th className="p-3.5">রেফারেল</th>
                          <th className="p-3.5">স্ট্যাটাস</th>
                          <th className="p-3.5">যোগদানের তারিখ</th>
                          <th className="p-3.5 text-right">নিরাপত্তা অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {activeUsers
                          .filter(u =>
                            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.phone.includes(searchQuery) ||
                            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.id.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((u) => (
                            <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                              <td className="p-3.5">
                                <div className="font-bold text-white text-sm">{u.name}</div>
                                {u.email && (
                                  <div className="text-[11px] font-mono text-sky-300 truncate max-w-[200px]">
                                    {u.email}
                                  </div>
                                )}
                                <div className="text-[10px] font-mono text-slate-400">{u.id} • {u.memberTier}</div>
                              </td>
                              <td className="p-3.5 font-mono font-medium text-slate-200">
                                {u.phone || '—'}
                              </td>
                              <td className="p-3.5 font-bold text-emerald-400 text-sm">
                                ৳{u.balance?.toLocaleString()}
                              </td>
                              <td className="p-3.5 font-bold text-amber-400">
                                ৳{u.pendingEscrowBalance || 0}
                              </td>
                              <td className="p-3.5 font-bold font-mono">
                                <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-[10px] text-amber-300">
                                  {u.referralsCount || 0} জন
                                </span>
                              </td>
                              <td className="p-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>সক্রিয় (Active)</span>
                                </span>
                              </td>
                              <td className="p-3.5 text-slate-400 text-[11px]">
                                {u.joinedDate}
                              </td>
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => setUserToBlock(u)}
                                  className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-rose-600/20 cursor-pointer transition-all active:scale-95"
                                  title="ইউজারকে ব্লক করুন ও সেশন বাতিল করুন"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>ব্লক করুন</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {renderUserReferralAnalytics()}
            </div>
          )}

          {/* TAB 3: BLOCKED USERS LIST (REQUIREMENT 4B) */}
          {activeTab === 'blocked_users' && (
            <div className="space-y-4">
              
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <UserX className="w-4 h-4 text-rose-400" />
                    <span>ব্লকড ইউজার তালিকা ({blockedUsers.length} জন)</span>
                  </h3>
                  <p className="text-xs text-rose-200 mt-0.5">
                    এই ইউজারদের সেশন স্থগিত। "আনব্লক করুন" ক্লিক করলে তারা তাৎক্ষণিকভাবে আবার লগইন ও কাজকর্ম করতে পারবেন
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ব্লকড ইউজার খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-rose-500 w-full sm:w-64"
                  />
                </div>
              </div>

              {blockedUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
                  <h4 className="font-bold text-white text-sm">কোনো ব্লকড ইউজার নেই</h4>
                  <p className="text-xs text-slate-400">
                    প্ল্যাটফর্মের সকল ব্যবহারকারী বর্তমানে সক্রিয় এবং নিরাপদ অবস্থায় রয়েছেন।
                  </p>
                </div>
              ) : (
                <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-700">
                        <tr>
                          <th className="p-3.5">ইউজার তথ্য</th>
                          <th className="p-3.5">মোবাইল নম্বর</th>
                          <th className="p-3.5">ব্যালেন্স</th>
                          <th className="p-3.5">ব্লক করার কারণ</th>
                          <th className="p-3.5">আপিল স্ট্যাটাস</th>
                          <th className="p-3.5 text-right">অ্যাকশন (আনব্লক)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {blockedUsers
                          .filter(u => 
                            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            u.phone.includes(searchQuery)
                          )
                          .map((u) => {
                            const hasAppeal = feedbacks.some(f => f.userPhone.replace(/\D/g, '') === u.phone.replace(/\D/g, '') && f.category === 'blocked_account_appeal');
                            return (
                              <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                                <td className="p-3.5">
                                  <div className="font-bold text-white text-sm">{u.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{u.id}</div>
                                </td>
                                <td className="p-3.5 font-mono font-medium text-rose-300">
                                  {u.phone}
                                </td>
                                <td className="p-3.5 font-bold text-slate-300">
                                  ৳{u.balance?.toLocaleString()}
                                </td>
                                <td className="p-3.5 text-rose-300 text-xs">
                                  {u.blockReason || 'অ্যাডমিন কর্তৃক অ্যাকাউন্ট স্থগিত'}
                                </td>
                                <td className="p-3.5">
                                  {hasAppeal ? (
                                    <button
                                      onClick={() => {
                                        playSound('click');
                                        setActiveTab('appeals');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-bold hover:bg-rose-900 cursor-pointer"
                                    >
                                      <AlertCircle className="w-3 h-3 text-rose-400" />
                                      <span>আপিল জমা দিয়েছে →</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">কোনো আপিল নেই</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-right">
                                  <button
                                    onClick={() => {
                                      playSound('success');
                                      onToggleBlockUser(u.id);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 cursor-pointer transition-all active:scale-95"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>আনব্লক করুন</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4A: BLOCKED USER APPEALS INBOX (PENDING ONLY - RESOLVED MOVE TO HISTORY/ARCHIVE) */}
          {activeTab === 'appeals' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-red-950/40 to-slate-900 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-rose-900/60 border border-rose-500/40 text-rose-300 flex items-center justify-center shrink-0 shadow-inner">
                    <AlertCircle className="w-6 h-6 text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base text-white">
                        চলমান ব্লকড ইউজার আপিল আবেদন (Pending Appeals)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono shadow-sm">
                        {pendingAppeals.length} টি অপেক্ষমাণ
                      </span>
                    </div>
                    <p className="text-xs text-rose-200/80 mt-0.5">
                      সমাধান বা আনব্লক করার পর আবেদনগুলো স্বয়ংক্রিয়ভাবে "হিস্ট্রি ও আর্কাইভ" বিভাগে সংরক্ষিত হবে।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300">
                    ব্লকড ইউজার: <strong className="text-rose-400 font-mono">{blockedUsers.length} জন</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setArchiveFilter('appeals');
                      setActiveTab('history_archive');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>আর্কাইভ দেখুন ({resolvedAppeals.length}) →</span>
                  </button>
                </div>
              </div>

              {pendingAppeals.length === 0 ? (
                <div className="text-center py-14 text-slate-400 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-200">কোনো পেন্ডিং ব্লকড অ্যাকাউন্ট আপিল নেই</h4>
                  <p className="text-xs text-slate-500">সমাধানকৃত আপিলগুলো "হিস্ট্রি ও আর্কাইভ" ট্যাবে সংরক্ষিত রয়েছে।</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAppeals.map((fb) => {
                    const matchedUser = users.find(u => (u.phone || '').replace(/\D/g, '') === (fb.userPhone || '').replace(/\D/g, ''));
                    const isUserCurrentlyBlocked = matchedUser?.isBlocked ?? true;

                    return (
                      <div
                        key={fb.id}
                        className="p-4 sm:p-5 rounded-2xl border bg-rose-950/20 border-rose-800/60 hover:border-rose-600/80 transition-all shadow-sm space-y-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-indigo-400 font-bold">#{fb.id}</span>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                                <AlertCircle className="w-3 h-3" />
                                <span>ব্লকড অ্যাকাউন্ট আপিল</span>
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{fb.date}</span>
                              </span>
                            </div>

                            <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                              <span>{fb.userName}</span>
                              <span className="text-xs font-mono text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                                {fb.userPhone}
                              </span>
                              {matchedUser?.email && (
                                <span className="text-xs font-mono text-sky-300">
                                  ({matchedUser.email})
                                </span>
                              )}
                              {isUserCurrentlyBlocked ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-bold">
                                  অ্যাকাউন্ট বর্তমানে স্থগিত
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
                                  অ্যাকাউন্ট সক্রিয়
                                </span>
                              )}
                            </div>

                            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-900/40 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                              {fb.message}
                            </div>
                          </div>

                          {/* Quick Admin Action Buttons */}
                          <div className="flex flex-row md:flex-col gap-2 shrink-0 self-end md:self-start">
                            {matchedUser && isUserCurrentlyBlocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  playSound('success');
                                  onToggleBlockUser(matchedUser.id);
                                  onReplyFeedback(fb.id, 'আপনার আপিল আবেদন গৃহীত হয়েছে এবং অ্যাকাউন্ট তাৎক্ষণিকভাবে আনব্লক করে সচল করা হয়েছে।');
                                }}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer transition-all active:scale-95"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>সেশন আনব্লক করুন</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setReplyingFbId(fb.id)}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>উত্তর ও সমাধান</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                playSound('success');
                                onReplyFeedback(fb.id, 'আপিলটি পর্যালোচনা সম্পন্ন হয়েছে ও আর্কাইভে সংরক্ষণ করা হয়েছে।');
                              }}
                              className="px-3 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-700 text-cyan-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-cyan-700/50 cursor-pointer transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>আর্কাইভ করুন</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4B: COMPLAINTS & SUGGESTIONS INBOX (PENDING ONLY - RESOLVED MOVE TO HISTORY/ARCHIVE) */}
          {activeTab === 'complaints' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-teal-950/60 border border-teal-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-900/60 border border-teal-500/40 text-teal-300 flex items-center justify-center shrink-0 shadow-inner">
                    <MessageSquare className="w-6 h-6 text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base text-white">
                        চলমান অভিযোগ ও পরামর্শ (Pending Complaints & Suggestions)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white font-mono shadow-sm">
                        {pendingComplaints.length} টি অপেক্ষমাণ
                      </span>
                    </div>
                    <p className="text-xs text-teal-200/80 mt-0.5">
                      উত্তর দিয়ে সমাধান করলে বার্তাগুলো স্বয়ংক্রিয়ভাবে "হিস্ট্রি ও আর্কাইভ" বিভাগে সংরক্ষিত হবে।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setArchiveFilter('complaints');
                      setActiveTab('history_archive');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>আর্কাইভ দেখুন ({resolvedComplaints.length}) →</span>
                  </button>
                </div>
              </div>

              {pendingComplaints.length === 0 ? (
                <div className="text-center py-14 text-slate-400 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-200">সব অভিযোগ ও পরামর্শ সমাধান হয়ে গেছে!</h4>
                  <p className="text-xs text-slate-500">পূর্বের সমাধানকৃত বার্তাগুলো "হিস্ট্রি ও আর্কাইভ" ট্যাবে দেখতে পাবেন।</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingComplaints.map((fb) => (
                    <div
                      key={fb.id}
                      className="p-4 sm:p-5 rounded-2xl border bg-slate-800/80 border-slate-700 hover:border-teal-500/40 transition-all shadow-sm space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-indigo-400 font-bold">#{fb.id}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-900/80 text-teal-300 border border-teal-700">
                              {fb.category || 'সাধারণ ফিডব্যাক'}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{fb.date}</span>
                            </span>
                          </div>

                          <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                            <span>{fb.userName}</span>
                            <span className="text-xs font-mono text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                              {fb.userPhone}
                            </span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                            {fb.message}
                          </div>
                        </div>

                        {/* Reply & Resolve Action Buttons */}
                        <div className="flex flex-row md:flex-col gap-2 shrink-0 self-end md:self-start">
                          <button
                            type="button"
                            onClick={() => setReplyingFbId(fb.id)}
                            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>উত্তর ও সমাধান</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playSound('success');
                              onReplyFeedback(fb.id, 'সমাধান করা হয়েছে ও আর্কাইভে সংরক্ষণ করা হয়েছে।');
                            }}
                            className="px-3.5 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-700 text-cyan-300 hover:text-white border border-cyan-700/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>আর্কাইভ করুন</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback Reply Modal (Shared by Appeals and Complaints) */}
          {replyingFbId && (
            <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
              <div className="relative my-auto w-full max-w-[436px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4">
                <button
                  type="button"
                  onClick={() => setReplyingFbId(null)}
                  className="absolute top-3.5 right-3.5 w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-white border border-slate-600 hover:border-rose-500 font-black text-xl leading-none flex items-center justify-center cursor-pointer transition-all"
                  aria-label="Close Reply Modal"
                  title="বন্ধ করুন (×)"
                >
                  &times;
                </button>
                <h4 className="font-bold text-sm text-white flex items-center gap-2 pr-10">
                  <MessageSquare className="w-4 h-4 text-teal-400" />
                  <span>ব্যবহারকারীর বার্তার উত্তর ও সমাধান</span>
                </h4>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="অ্যাডমিন অফিসিয়াল উত্তর লিখুন (উত্তর পাঠানোর পর এটি আর্কাইভে সংরক্ষিত হবে)..."
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-teal-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmFeedbackReply(replyingFbId)}
                    className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer"
                  >
                    জবাব পাঠান ও আর্কাইভ করুন
                  </button>
                  <button
                    onClick={() => setReplyingFbId(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PENDING WITHDRAWALS MANAGEMENT (PROCESSED MOVED TO HISTORY/ARCHIVE) */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-pink-400" />
                    <span>পেন্ডিং উইথড্রয়াল রিকোয়েস্ট ({pendingWithdrawals.length} টি)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    অনুমোদন বা বাতিল করার পর রিকোয়েস্টগুলো স্বয়ংক্রিয়ভাবে "হিস্ট্রি ও আর্কাইভ" বিভাগে সংরক্ষিত হবে
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setArchiveFilter('withdrawals');
                    setActiveTab('history_archive');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>প্রসেসকৃত আর্কাইভ দেখুন ({processedWithdrawals.length}) →</span>
                </button>
              </div>

              {pendingWithdrawals.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                  <div className="text-sm font-bold text-slate-200">কোনো পেন্ডিং উইথড্র রিকোয়েস্ট নেই</div>
                  <div className="text-xs text-slate-500">সকল প্রসেসকৃত উইথড্র হিস্ট্রি ও আর্কাইভ বিভাগে সংরক্ষিত রয়েছে।</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingWithdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-400 text-xs">#{w.id}</span>
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-pink-950 text-pink-300 border border-pink-800">
                            {w.method} ({w.accountType})
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 animate-pulse">
                            ⏳ পেন্ডিং রিভিউ
                          </span>
                        </div>

                        <div className="text-sm font-bold text-white">
                          ইউজার: {w.userName} (<span className="font-mono text-emerald-400">{w.accountNumber}</span>)
                        </div>

                        <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                          <span>পরিমাণ: <strong className="text-emerald-400 text-sm">৳{w.amount}</strong></span>
                          <span>তারিখ: {w.date}</span>
                          {w.trxId && <span>TrxID: <strong className="font-mono text-indigo-300">{w.trxId}</strong></span>}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            playSound('success');
                            onApproveWithdrawal(w.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>অনুমোদন করুন</span>
                        </button>

                        <button
                          onClick={() => setRejectingWdrId(w.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs border border-rose-600/40 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>বাতিল ও রিফান্ড</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reject Reason Modal */}
              {rejectingWdrId && (
                <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
                  <div className="relative my-auto w-full max-w-[400px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4">
                    <button
                      type="button"
                      onClick={() => setRejectingWdrId(null)}
                      className="absolute top-3.5 right-3.5 w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-white border border-slate-600 hover:border-rose-500 font-black text-xl leading-none flex items-center justify-center cursor-pointer transition-all"
                      aria-label="Close Reject Withdrawal Modal"
                      title="বন্ধ করুন (×)"
                    >
                      &times;
                    </button>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2 pr-10">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>উইথড্রয়াল বাতিল ও রিফান্ড নিশ্চিতকরণ</span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      বাতিল করার পর উত্তোলনের পুরো টাকা ইউজারের ব্যালেন্সে সাথে সাথে ফেরত যাবে।
                    </p>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        বাতিলের কারণ নির্বাচন করুন:
                      </label>
                      <select
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none"
                      >
                        <option value="ভুল একাউন্ট নম্বর প্রদান করা হয়েছে">ভুল একাউন্ট নম্বর প্রদান করা হয়েছে</option>
                        <option value="বিকাশ লিমিট পার হয়েছে">বিকাশ লিমিট পার হয়েছে</option>
                        <option value="ব্যবহারকারীর অনুরোধে বাতিল">ব্যবহারকারীর অনুরোধে বাতিল</option>
                        <option value="সন্দেহজনক লেনদেন যাচাই">সন্দেহজনক লেনদেন যাচাই</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleConfirmRejectWithdrawal(rejectingWdrId)}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        হ্যাঁ, রিফান্ড করুন
                      </button>
                      <button
                        onClick={() => setRejectingWdrId(null)}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB: LIVE REGISTERED USERS LIST & SEARCH (DEDICATED SECTION - REQUIREMENT 8) */}
          {activeTab === 'live_users' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border border-amber-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-amber-900/60 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
                    <Users className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base text-white">
                        লাইভ রেজিস্টার্ড ইউজার তালিকা ও দ্রুত সার্চ (Live User Search & Directory)
                      </h3>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      Gmail আইডি বা মোবাইল নম্বর দিয়ে সার্চ করে যেকোনো মেম্বারকে সবার শীর্ষে এনে লাইভ প্রোফাইল ও ব্যালেন্স যাচাই করুন
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300">
                    মোট: <strong className="text-white font-mono">{users.length}</strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300">
                    সক্রিয়: <strong className="font-mono">{activeUsers.length}</strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
                    ব্লকড: <strong className="font-mono">{blockedUsers.length}</strong>
                  </span>
                </div>
              </div>

              {/* Functional Search Box */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3 shadow-md">
                <div className="relative">
                  <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={liveUserSearch}
                    onChange={(e) => setLiveUserSearch(e.target.value)}
                    placeholder="Gmail এড্রেস (যেমন: user@gmail.com) অথবা মোবাইল নম্বর দিয়ে তাৎক্ষণিক সার্চ করুন..."
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
                  />
                  {liveUserSearch && (
                    <button
                      type="button"
                      onClick={() => setLiveUserSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      title="সার্চ মুছুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>💡 সার্চ করা Gmail বা মোবাইল নম্বরের ইউজার স্বয়ংক্রিয়ভাবে তালিকার সবার শীর্ষে প্রদর্শিত হবে</span>
                  {liveUserSearch.trim() && (
                    <span className="text-amber-400 font-bold font-mono">
                      সার্চ কুয়েরি: "{liveUserSearch}"
                    </span>
                  )}
                </div>
              </div>

              {/* Filtered Live Users Directory Table */}
              {(() => {
                const q = liveUserSearch.trim().toLowerCase();
                const queryDigits = q.replace(/\D/g, '');

                const filteredUsers = users
                  .filter((u) => {
                    if (!q) return true;
                    const email = (u.email || '').toLowerCase();
                    const phone = (u.phone || '').toLowerCase();
                    const phoneDigits = (u.phone || '').replace(/\D/g, '');
                    const name = (u.name || '').toLowerCase();
                    const id = (u.id || '').toLowerCase();
                    const refCode = (u.referralCode || '').toLowerCase();
                    return (
                      email.includes(q) ||
                      phone.includes(q) ||
                      (queryDigits.length >= 3 && phoneDigits.includes(queryDigits)) ||
                      name.includes(q) ||
                      id.includes(q) ||
                      refCode.includes(q)
                    );
                  })
                  .sort((a, b) => {
                    if (!q) {
                      const balDiff = (b.balance || 0) - (a.balance || 0);
                      if (balDiff !== 0) return balDiff;
                      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
                    }
                    const aEmail = (a.email || '').toLowerCase();
                    const bEmail = (b.email || '').toLowerCase();
                    const aPhoneDigits = (a.phone || '').replace(/\D/g, '');
                    const bPhoneDigits = (b.phone || '').replace(/\D/g, '');

                    const aExactEmail = aEmail === q;
                    const bExactEmail = bEmail === q;
                    if (aExactEmail && !bExactEmail) return -1;
                    if (!aExactEmail && bExactEmail) return 1;

                    const aExactPhone = queryDigits.length >= 6 && aPhoneDigits === queryDigits;
                    const bExactPhone = queryDigits.length >= 6 && bPhoneDigits === queryDigits;
                    if (aExactPhone && !bExactPhone) return -1;
                    if (!aExactPhone && bExactPhone) return 1;

                    const aEmailPart = aEmail.includes(q);
                    const bEmailPart = bEmail.includes(q);
                    if (aEmailPart && !bEmailPart) return -1;
                    if (!aEmailPart && bEmailPart) return 1;

                    const aPhonePart = queryDigits.length >= 3 && aPhoneDigits.includes(queryDigits);
                    const bPhonePart = queryDigits.length >= 3 && bPhoneDigits.includes(queryDigits);
                    if (aPhonePart && !bPhonePart) return -1;
                    if (!aPhonePart && bPhonePart) return 1;

                    const balDiff = (b.balance || 0) - (a.balance || 0);
                    if (balDiff !== 0) return balDiff;
                    return (b.createdAtMs || 0) - (a.createdAtMs || 0);
                  });

                if (filteredUsers.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 space-y-2">
                      <Users className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-300">কোনো ইউজার একাউন্ট খুঁজে পাওয়া যায়নি</p>
                      <p className="text-[11px] text-slate-500">
                        "{liveUserSearch}" এর সাথে মিল রেখে কোনো Gmail বা মোবাইল নম্বর পাওয়া যায়নি।
                      </p>
                      <button
                        type="button"
                        onClick={() => setLiveUserSearch('')}
                        className="mt-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 font-bold cursor-pointer"
                      >
                        সার্চ রিসেট করুন
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/60">
                      <span className="text-xs font-bold text-slate-200">
                        লাইভ ইউজার তালিকা ({filteredUsers.length} জন প্রদর্শিত)
                      </span>
                      {q && (
                        <span className="text-[11px] font-mono text-amber-400 font-bold">
                          শীর্ষে সার্চ রেজাল্ট হাইলাইট করা হয়েছে
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold sticky top-0 border-b border-slate-800 z-10">
                          <tr>
                            <th className="p-3">ইউজার প্রোফাইল</th>
                            <th className="p-3">Gmail ও মোবাইল</th>
                            <th className="p-3">উইথড্র যোগ্য</th>
                            <th className="p-3">এস্ক্রো ব্যালেন্স</th>
                            <th className="p-3">কয়েন</th>
                            <th className="p-3">স্ট্যাটাস</th>
                            <th className="p-3 text-right">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredUsers.map((u) => {
                            const isExactMatch =
                              Boolean(q) &&
                              ((u.email && u.email.toLowerCase().includes(q)) ||
                                (queryDigits.length >= 4 && (u.phone || '').replace(/\D/g, '').includes(queryDigits)));

                            return (
                              <tr
                                key={u.id}
                                className={`transition-colors ${
                                  isExactMatch
                                    ? 'bg-amber-950/40 border-l-4 border-amber-400'
                                    : 'hover:bg-slate-800/50'
                                }`}
                              >
                                {/* User / Profile */}
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                                        <span>{u.name || 'নাম নেই'}</span>
                                        {u.role === 'admin' && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-900/80 text-purple-300 border border-purple-700 font-bold">
                                            এডমিন
                                          </span>
                                        )}
                                        {isExactMatch && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-400 text-slate-950 font-black">
                                            সার্চ ম্যাচ
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]">
                                        UID: {u.id}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        টিয়ার: {u.memberTier || 'ভেরিফাইড মেম্বার'}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Gmail & Mobile */}
                                <td className="p-3 space-y-1">
                                  <div className="flex items-center gap-1.5 font-mono text-xs text-sky-300">
                                    <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    <span className="truncate max-w-[180px]" title={u.email || ''}>
                                      {u.email || '—'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-300">
                                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>{u.phone || '—'}</span>
                                  </div>
                                  {u.referralCode && (
                                    <div className="text-[10px] font-mono text-amber-400/80">
                                      রেফার: {u.referralCode} ({u.referralsCount || 0} জন)
                                    </div>
                                  )}
                                </td>

                                {/* Withdrawable Balance */}
                                <td className="p-3">
                                  <div className="font-bold font-mono text-emerald-400 text-xs sm:text-sm">
                                    ৳{(u.balance || 0).toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">উইথড্র যোগ্য</div>
                                </td>

                                {/* Escrow Balance */}
                                <td className="p-3">
                                  <div className="font-bold font-mono text-amber-400 text-xs">
                                    ৳{(u.pendingEscrowBalance || 0).toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">এস্ক্রো হোল্ড</div>
                                </td>

                                {/* Coins */}
                                <td className="p-3">
                                  <div className="font-bold font-mono text-indigo-300 text-xs">
                                    {u.coins || 0}
                                  </div>
                                  <div className="text-[10px] text-slate-500">কয়েন</div>
                                </td>

                                {/* Status */}
                                <td className="p-3 space-y-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      u.isBlocked
                                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        u.isBlocked ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
                                      }`}
                                    />
                                    <span>{u.isBlocked ? 'ব্লকড' : 'সক্রিয়'}</span>
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    {u.joinedDate || '—'}
                                  </div>
                                </td>

                                {/* Security Action */}
                                <td className="p-3 text-right">
                                  {u.isBlocked ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        playSound('success');
                                        onToggleBlockUser(u.id);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm cursor-pointer transition-all active:scale-95"
                                      title="ইউজারকে আনব্লক করুন"
                                    >
                                      <Unlock className="w-3 h-3" />
                                      <span>আনব্লক</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setUserToBlock(u)}
                                      className="px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm cursor-pointer transition-all active:scale-95"
                                      title="ইউজারকে ব্লক করুন"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>ব্লক</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* TAB 6: RESELL ORDERS & SMART ESCROW */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong className="block text-sm font-bold text-amber-300 mb-0.5">
                    স্মার্ট এস্ক্রো নীতি (Smart Escrow Protocol):
                  </strong>
                  কাস্টমার কুরিয়ার থেকে পণ্য বুঝে নিয়ে মূল্য পরিশোধ করার পরই কেবল "ডেলিভার্ড ও পেইড (কমিশন রিলিজ)" বাটনে ক্লিক করবেন। সাথে সাথে রিসেলারের পেন্ডিং এস্ক্রো ব্যালেন্স আসল উইথড্রয়াল ব্যালেন্সে ট্রান্সফার হবে।
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl">
                  কোনো অর্ডার বুকিং পাওয়া যায়নি
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <img
                          src={order.productImage}
                          alt={order.productTitle}
                          className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-400 text-xs">#{order.id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.status === 'delivered_paid'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : order.status === 'shipped'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            }`}>
                              {order.status === 'delivered_paid' ? 'ডেলিভার্ড ও কমিশন পেইড' : order.status === 'shipped' ? 'কুরিয়ারে রওয়ানা' : 'পেন্ডিং কুরিয়ার বুকিং'}
                            </span>
                          </div>

                          <div className="text-sm font-bold text-white">
                            {order.productTitle}
                          </div>

                          <div className="text-xs text-slate-300">
                            কাস্টমার: <strong>{order.customerName}</strong> ({order.customerPhone}) • {order.customerAddress}
                          </div>

                          <div className="text-xs text-slate-400 flex items-center gap-3 pt-1">
                            <span>বিক্রয় মূল্য: <strong>৳{order.sellingPrice}</strong></span>
                            <span>রিসেলার কমিশন: <strong className="text-emerald-400 font-bold">৳{order.commission}</strong></span>
                            <span>রিসেলার: {order.resellerName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {order.status === 'pending_courier' && (
                          <button
                            onClick={() => {
                              playSound('click');
                              onUpdateOrderStatus(order.id, 'shipped');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>কুরিয়ারে পাঠান</span>
                          </button>
                        )}

                        {(!order.escrowReleased || order.status !== 'delivered_paid') && (
                          <button
                            onClick={() => {
                              playSound('success');
                              onApproveEscrowOrder(order.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-colors cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>ডেলিভার্ড ও কমিশন রিলিজ</span>
                          </button>
                        )}

                        {order.escrowReleased && (
                          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>কমিশন রিলিজড</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: PRODUCTS MANAGEMENT */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-purple-400" />
                    <span>পণ্য ক্যাটালগ ও ইনভেন্টরি ম্যানেজমেন্ট</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    এডমিন প্যানেল থেকে পণ্য যোগ করলে তা রিসেলিং শপে প্রদর্শিত হবে
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setProdError('');
                    setProdSuccess('');
                    if (isEditingProduct) {
                      setIsEditingProduct(false);
                      setEditingProdId(null);
                    } else {
                      setEditingProdId(null);
                      setProdTitle('');
                      setProdTitleEn('');
                      setProdCategory('medicine');
                      setCustomerPrice('500');
                      setCommission('150');
                      setDeliveryInside('60');
                      setDeliveryOutside('120');
                      setImage('');
                      setImagePreview('');
                      setFeatures('অরিজিনাল ও অথেনটিক,ক্যাশ অন ডেলিভারি');
                      setIsEditingProduct(true);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isEditingProduct ? 'ফর্ম লুকান' : 'নতুন পণ্য যোগ করুন'}</span>
                </button>
              </div>

              {prodSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-600/60 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{prodSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProdSuccess('')}
                    className="text-emerald-300 hover:text-white cursor-pointer px-1"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Product Add / Edit Form */}
              {isEditingProduct && (
                <form
                  ref={productFormRef}
                  onSubmit={handleSaveProduct}
                  className={`p-4 sm:p-5 rounded-2xl bg-slate-800 space-y-4 animate-in fade-in scroll-mt-4 ${
                    editingProdId
                      ? 'border-2 border-amber-400/90 ring-2 ring-amber-500/25 shadow-lg shadow-amber-950/30'
                      : 'border border-purple-500/40'
                  }`}
                >
                  {editingProdId && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">
                          এডিট মোড সক্রিয় — &ldquo;{prodTitle || 'পণ্য'}&rdquo; আপডেট করা হচ্ছে
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black shrink-0">
                        EDIT MODE
                      </span>
                    </div>
                  )}

                  <h4 className="font-bold text-sm text-purple-300 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>{editingProdId ? 'পণ্য এডিট করুন' : 'নতুন পণ্য তথ্য ফরম'}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">পণ্যের বাংলা নাম *</label>
                      <input
                        type="text"
                        required
                        value={prodTitle}
                        onChange={(e) => setProdTitle(e.target.value)}
                        placeholder="যেমন: ডায়াবেটিস কেয়ার ক্যাপসুল বা স্মার্ট ওয়াচ"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">পণ্যের ইংরেজি নাম *</label>
                      <input
                        type="text"
                        required
                        value={prodTitleEn}
                        onChange={(e) => setProdTitleEn(e.target.value)}
                        placeholder="e.g. Diabetes Care Herbal Pack"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Category, Selling Price & Reseller Commission */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">ক্যাটাগরি *</label>
                      <select
                        value={prodCategory}
                        onChange={(e) => setProdCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-purple-500 font-medium"
                      >
                        <option value="medicine">ঔষধ ও স্বাস্থ্য (Medicine & Health)</option>
                        <option value="gadget">গ্যাজেট (Gadget)</option>
                        <option value="fashion">ফ্যাশন (Fashion)</option>
                        <option value="beauty">বিউটি (Beauty)</option>
                        <option value="home">হোম ও কিচেন (Home & Kitchen)</option>
                        <option value="grocery">মুদি ও খাদ্য (Grocery & Food)</option>
                        <option value="others">অন্যান্য (Others)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">কাস্টমার বিক্রয় মূল্য (৳) *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        min={1}
                        required
                        value={customerPrice}
                        onChange={(e) => setCustomerPrice(e.target.value)}
                        placeholder="যেমন: 500"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-400 mb-1">রিসেলার কমিশন (৳) *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        min={0}
                        required
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                        placeholder="যেমন: 150"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/50 text-xs text-emerald-400 font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Mandatory Delivery Charges Inside and Outside Dhaka */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-700/80">
                    <div>
                      <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>ডেলিভারি চার্জ (ঢাকার ভেতরে) *</span>
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        min={0}
                        required
                        value={deliveryInside}
                        onChange={(e) => setDeliveryInside(e.target.value)}
                        placeholder="যেমন: ৬০"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none font-bold focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>ডেলিভারি চার্জ (ঢাকার বাইরে) *</span>
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        min={0}
                        required
                        value={deliveryOutside}
                        onChange={(e) => setDeliveryOutside(e.target.value)}
                        placeholder="যেমন: ১২০"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none font-bold focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Image File Uploader & Instant Preview */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      পণ্যের ছবি আপলোড করুন (গ্যালারি / ডিভাইস থেকে ফাইল সিলেক্ট করুন) *
                    </label>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input
                        ref={productImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="sr-only"
                        tabIndex={-1}
                        aria-label="ডিভাইস গ্যালারি বা ফাইল থেকে ছবি নির্বাচন করুন"
                      />
                      <button
                        type="button"
                        disabled={isProcessingImage || isSavingProduct}
                        onClick={() => {
                          setProdError('');
                          try {
                            if (productImageInputRef.current) {
                              productImageInputRef.current.value = '';
                              productImageInputRef.current.click();
                            }
                          } catch {
                            setProdError('ব্রাউজার গ্যালারি বা ফাইল পিকার খুলতে পারেনি। অনুগ্রহ করে স্টোরেজ পারমিশন দিন অথবা নিচে ইমেজ লিংক ব্যবহার করুন।');
                            playSound('error');
                          }
                        }}
                        className="flex-1 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-purple-500/60 hover:border-purple-400 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 text-xs font-bold cursor-pointer transition-colors disabled:opacity-60"
                      >
                        <Radio className="w-4 h-4 shrink-0" />
                        <span>
                          {isProcessingImage
                            ? 'ছবি প্রসেস ও কম্প্রেস হচ্ছে...'
                            : 'ডিভাইস গ্যালারি / ফাইল থেকে ছবি নির্বাচন করুন'}
                        </span>
                      </button>

                      <div className="w-full sm:w-auto text-center text-xs text-slate-500">অথবা</div>

                      <div className="flex-1 w-full">
                        <input
                          type="url"
                          value={image}
                          onChange={(e) => {
                            setImage(e.target.value);
                            setImagePreview(e.target.value);
                            if (prodError) setProdError('');
                          }}
                          placeholder="ইমেজ ওয়েব লিংক (URL) লিখুন"
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Instant Preview Box */}
                    {imagePreview && (
                      <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-16 h-16 rounded-lg object-cover border border-purple-500/50"
                        />
                        <div className="text-xs text-slate-300 flex-1">
                          <span className="font-bold text-emerald-400 block">ছবি সফলভাবে প্রিভিউ হয়েছে</span>
                          <span className="text-[11px] text-slate-400">পাবলিশ করার পর রিসেলিং শপে এটি প্রদর্শিত হবে</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setImage(''); setImagePreview(''); }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold cursor-pointer"
                        >
                          মুছে ফেলুন
                        </button>
                      </div>
                    )}
                  </div>

                  {prodError && (
                    <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-300 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{prodError}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSavingProduct || isProcessingImage}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isSavingProduct
                          ? 'Firebase-এ সেভ হচ্ছে...'
                          : editingProdId
                            ? 'আপডেট সেভ করুন'
                            : 'পণ্য পাবলিশ করুন'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingProduct}
                      onClick={() => {
                        setIsEditingProduct(false);
                        setEditingProdId(null);
                        setProdError('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer disabled:opacity-50"
                    >
                      বাতিল
                    </button>
                  </div>
                </form>
              )}

              {/* Products Table or Empty Notice */}
              {products.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 p-6 space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto text-purple-400 opacity-60" />
                  <h5 className="font-bold text-white text-sm">ইনভেন্টরি সম্পূর্ণ খালি</h5>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    বর্তমানে কোনো পণ্য যোগ করা নেই। উপরের <strong className="text-purple-300">"নতুন পণ্য যোগ করুন"</strong> বাটনে ক্লিক করে পণ্য ইমেজ, বাংলা নাম, ইংরেজি নাম, পাইকারি দাম ও রিসেলার কমিশন দিয়ে পণ্য যুক্ত করুন।
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {products.map((p) => {
                    const isBeingEdited = editingProdId === p.id && isEditingProduct;
                    return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl flex gap-3.5 items-center transition-all ${
                        isBeingEdited
                          ? 'bg-slate-800 border-2 border-amber-400/90 ring-2 ring-amber-500/20'
                          : 'bg-slate-800/80 border border-slate-700'
                      }`}
                    >
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-700"
                      />
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-xs sm:text-sm text-white truncate">{p.title}</h5>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          বিক্রয়: ৳{p.customerPrice} • ডেলিভারি: ৳{p.deliveryChargeInside ?? 60} (ঢাকা) / ৳{p.deliveryChargeOutside ?? 120} (বাইরে)
                        </div>
                        <div className="text-xs font-bold text-emerald-400 mt-1">
                          কমিশন: ৳{p.commission}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditProductClick(p)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isBeingEdited
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-700 hover:bg-purple-600 text-slate-300 hover:text-white'
                          }`}
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playSound('click');
                            onDeleteProduct(p.id);
                          }}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: MICRO-TASKS MANAGEMENT (ADMIN CREATE / DELETE) & WORKER PROOFS */}
          {activeTab === 'jobs_proofs' && (
            <div className="space-y-6">

              {/* Section 0: Admin Manual Micro-Task Creation (Zero Hardcoded Tasks) */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-blue-500/30 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <h4 className="font-extrabold text-sm text-white">
                      নতুন মাইক্রো-টাস্ক যোগ করুন (Admin Manual Task)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    মোট সক্রিয় টাস্ক: {jobs.filter(j => j.status === 'active').length} টি
                  </span>
                </div>

                {adminJobNotice && (
                  <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-200 text-xs font-bold flex items-center justify-between gap-2">
                    <span>{adminJobNotice}</span>
                    <button type="button" onClick={() => setAdminJobNotice(null)} className="text-blue-300 hover:text-white cursor-pointer">
                      &times;
                    </button>
                  </div>
                )}

                <form onSubmit={handleCreateAdminMicroJob} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-300 mb-1">টাস্কের শিরোনাম *</label>
                    <input
                      type="text"
                      required
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      placeholder="টাস্কের নাম লিখুন..."
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">ক্যাটাগরি *</label>
                    <select
                      value={newJobCategory}
                      onChange={(e) => setNewJobCategory(e.target.value as MicroJob['category'])}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-blue-500"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="facebook">Facebook</option>
                      <option value="telegram">Telegram</option>
                      <option value="app">App Install</option>
                      <option value="review">Review</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-300 mb-1">টার্গেট লিংক (Target URL) *</label>
                    <input
                      type="url"
                      required
                      value={newJobTargetUrl}
                      onChange={(e) => setNewJobTargetUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">রিওয়ার্ড (৳) *</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        onWheel={(e) => e.currentTarget.blur()}
                        required
                        min={1}
                        step="0.5"
                        value={newJobReward}
                        onChange={(e) => setNewJobReward(e.target.value)}
                        placeholder="৳"
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">মোট স্লট *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        required
                        min={1}
                        value={newJobSlots}
                        onChange={(e) => setNewJobSlots(e.target.value)}
                        placeholder="স্লট"
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">আনুমানিক সময়</label>
                    <input
                      type="text"
                      value={newJobTime}
                      onChange={(e) => setNewJobTime(e.target.value)}
                      placeholder="যেমন: ২ মিনিট"
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-300 mb-1">প্রয়োজনীয় প্রমাণ (Proof Note)</label>
                    <input
                      type="text"
                      value={newJobProofPlaceholder}
                      onChange={(e) => setNewJobProofPlaceholder(e.target.value)}
                      placeholder="ওয়ার্কারকে কী প্রমাণ দিতে হবে তা লিখুন..."
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block font-bold text-slate-300 mb-1">কাজের নির্দেশনা (প্রতি লাইনে একটি ধাপ)</label>
                    <textarea
                      rows={2}
                      value={newJobInstructions}
                      onChange={(e) => setNewJobInstructions(e.target.value)}
                      placeholder="কাজের ধাপগুলো লিখুন..."
                      className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={isCreatingJob}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isCreatingJob ? 'যোগ হচ্ছে...' : 'মাইক্রো-টাস্ক পাবলিশ করুন'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Section 1: All Micro-Tasks List (Clean Empty State when 0 Tasks) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>সকল মাইক্রো-টাস্ক তালিকা ({jobs.length})</span>
                  </h4>

                  {jobs.length > 0 && onAdminClearAllJobs && (
                    confirmClearAllJobs ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isClearingJobs}
                          onClick={async () => {
                            setIsClearingJobs(true);
                            playSound('click');
                            try {
                              await onAdminClearAllJobs();
                              playSound('success');
                            } finally {
                              setIsClearingJobs(false);
                              setConfirmClearAllJobs(false);
                            }
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                        >
                          {isClearingJobs ? 'মুছছে...' : `নিশ্চিত (${jobs.length} টি মুছুন)`}
                        </button>
                        <button
                          type="button"
                          disabled={isClearingJobs}
                          onClick={() => setConfirmClearAllJobs(false)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { playSound('click'); setConfirmClearAllJobs(true); }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>সব টাস্ক মুছুন (Clear All)</span>
                      </button>
                    )
                  )}
                </div>

                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-800/40 rounded-xl text-xs border border-dashed border-slate-700">
                    কোনো মাইক্রো-টাস্ক নেই। উপরের ফর্ম থেকে যেকোনো সময় নতুন টাস্ক যোগ করুন।
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">{job.title}</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-cyan-300 border border-slate-700">
                              {job.platform}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              job.status === 'active'
                                ? 'bg-emerald-950 text-emerald-300'
                                : job.status === 'rejected'
                                ? 'bg-rose-950 text-rose-300'
                                : 'bg-amber-950 text-amber-300'
                            }`}>
                              {job.status === 'active' ? 'সক্রিয় (Live)' : job.status === 'rejected' ? 'বাতিল' : 'পেন্ডিং'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            রিওয়ার্ড: <strong className="text-emerald-400">৳{job.reward}</strong> • স্লট: {job.completedSlots}/{job.totalSlots}
                            {job.paymentTrxId ? ` • TrxID: ${job.paymentTrxId}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {job.status === 'pending_admin_approval' && (
                            <>
                              <button
                                onClick={() => { playSound('success'); onApproveUserJob(job.id); }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>অনুমোদন</span>
                              </button>
                              <button
                                onClick={() => { playSound('error'); onRejectUserJob(job.id); }}
                                className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs cursor-pointer"
                              >
                                বাতিল
                              </button>
                            </>
                          )}
                          {onAdminDeleteJob && (
                            <button
                              type="button"
                              onClick={() => {
                                playSound('click');
                                onAdminDeleteJob(job.id);
                              }}
                              className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800 transition-colors cursor-pointer"
                              title="টাস্কটি মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Worker Proofs — Active Submissions Table + Archive Action */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>টাস্ক সাবমিশন ও প্রুফ যাচাই ({activeProofs.length})</span>
                    {pendingProofs.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        পেন্ডিং: {pendingProofs.length}
                      </span>
                    )}
                  </h4>

                  <button
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setArchiveFilter('proofs');
                      setActiveTab('history_archive');
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-700/70 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>আর্কাইভ দেখুন ({archivedProofs.length})</span>
                  </button>
                </div>

                {activeProofs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-800/40 rounded-2xl text-xs border border-dashed border-slate-700">
                    {archivedProofs.length > 0
                      ? 'সকল রিভিউকৃত সাবমিশন আর্কাইভে স্থানান্তর করা হয়েছে। নতুন সাবমিশন এলে এখানে প্রদর্শিত হবে।'
                      : 'বর্তমানে কোনো অ্যাক্টিভ টাস্ক সাবমিশন জমা নেই'}
                  </div>
                ) : (
                  <>
                    {/* Desktop Administrative Table */}
                    <div className="hidden md:block bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                            <tr>
                              <th className="p-3">টাস্ক ও সময়</th>
                              <th className="p-3">ওয়ার্কার</th>
                              <th className="p-3">জমা দেওয়া প্রমাণ</th>
                              <th className="p-3">রিওয়ার্ড</th>
                              <th className="p-3">স্ট্যাটাস</th>
                              <th className="p-3 text-right">অ্যাকশন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {activeProofs.map((prf) => {
                              const isReviewed = prf.status === 'approved' || prf.status === 'rejected';
                              const isBusy = archivingProofId === prf.id;
                              return (
                                <tr key={prf.id} className="hover:bg-slate-800/50 transition-colors align-top">
                                  <td className="p-3 max-w-[220px]">
                                    <div className="font-bold text-white break-words">{prf.jobTitle}</div>
                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                      #{prf.id} · {prf.submittedAt}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-200">{prf.workerName}</div>
                                    <div className="text-[11px] font-mono text-slate-400 break-all">{prf.workerPhone}</div>
                                  </td>
                                  <td className="p-3 max-w-[260px]">
                                    <div className="text-slate-200 font-mono text-[11px] bg-slate-950/70 p-2 rounded-lg border border-slate-800 break-words">
                                      {prf.proofText}
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono font-black text-emerald-400 whitespace-nowrap">
                                    ৳{prf.reward}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      prf.status === 'approved'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                        : prf.status === 'rejected'
                                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                                    }`}>
                                      {prf.status === 'approved' ? 'গৃহীত' : prf.status === 'rejected' ? 'প্রত্যাখ্যাত' : 'পেন্ডিং'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      {prf.status === 'pending' && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => { playSound('success'); onApproveProof(prf.id); }}
                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>অনুমোদন</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { playSound('error'); onRejectProof(prf.id); }}
                                            className="px-2.5 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-[11px] cursor-pointer"
                                          >
                                            বাতিল
                                          </button>
                                        </>
                                      )}
                                      {isReviewed && onArchiveProof && (
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={async () => {
                                            setArchivingProofId(prf.id);
                                            playSound('click');
                                            try {
                                              await onArchiveProof(prf.id, true);
                                            } finally {
                                              setArchivingProofId(null);
                                            }
                                          }}
                                          className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                                          title="রিভিউকৃত সাবমিশনটি আর্কাইভে পাঠান"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          <span>{isBusy ? 'আর্কাইভ হচ্ছে...' : 'আর্কাইভ (Archive)'}</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="md:hidden space-y-3">
                      {activeProofs.map((prf) => {
                        const isReviewed = prf.status === 'approved' || prf.status === 'rejected';
                        const isBusy = archivingProofId === prf.id;
                        return (
                          <div
                            key={prf.id}
                            className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3 min-w-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-white break-words">{prf.jobTitle}</div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  #{prf.id} · {prf.submittedAt} · <strong className="text-emerald-400">৳{prf.reward}</strong>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                prf.status === 'approved'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : prf.status === 'rejected'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}>
                                {prf.status === 'approved' ? 'গৃহীত' : prf.status === 'rejected' ? 'প্রত্যাখ্যাত' : 'পেন্ডিং'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-300 space-y-1">
                              <div>ওয়ার্কার: <strong className="text-white">{prf.workerName}</strong> (<span className="font-mono break-all">{prf.workerPhone}</span>)</div>
                              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-700 font-mono text-[11px] break-words">
                                প্রমাণ: "{prf.proofText}"
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {prf.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { playSound('success'); onApproveProof(prf.id); }}
                                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>অনুমোদন ও পেইড</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { playSound('error'); onRejectProof(prf.id); }}
                                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs cursor-pointer"
                                  >
                                    বাতিল
                                  </button>
                                </>
                              )}
                              {isReviewed && onArchiveProof && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    setArchivingProofId(prf.id);
                                    playSound('click');
                                    try {
                                      await onArchiveProof(prf.id, true);
                                    } finally {
                                      setArchivingProofId(null);
                                    }
                                  }}
                                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>{isBusy ? 'আর্কাইভ হচ্ছে...' : 'আর্কাইভ (Archive)'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: DYNAMIC GIFT CODES MANAGEMENT */}
          {activeTab === 'gift_codes' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30 shrink-0">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base sm:text-lg text-white">
                        ডাইনামিক গিফট কোড ম্যানেজমেন্ট
                      </h3>
                      <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                        Firebase Live
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      এখান থেকে নিজস্ব প্রোমো কোড তৈরি, কয়েন/ব্যালেন্স নির্ধারণ, সর্বোচ্চ সীমা সেট ও নিষ্ক্রিয়/ডিলিট করুন
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400">মোট গিফট কোড</div>
                    <div className="text-sm font-black text-amber-400 font-mono">
                      {giftCodes.length} টি
                    </div>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400">সক্রিয় কোড</div>
                    <div className="text-sm font-black text-emerald-400 font-mono">
                      {giftCodes.filter(g => g.active).length} টি
                    </div>
                  </div>
                </div>
              </div>

              {giftCodeNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
                  <span>{giftCodeNotice}</span>
                  <button type="button" onClick={() => setGiftCodeNotice(null)} className="text-emerald-400 hover:text-white px-2 py-1 cursor-pointer">✕</button>
                </div>
              )}

              {giftCodeError && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
                  <span>{giftCodeError}</span>
                  <button type="button" onClick={() => setGiftCodeError(null)} className="text-rose-400 hover:text-white px-2 py-1 cursor-pointer">✕</button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form: Create New Gift Code */}
                <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Plus className="w-4 h-4 text-amber-400" />
                    <h4 className="font-extrabold text-sm text-white">নতুন গিফট কোড তৈরি করুন</h4>
                  </div>

                  <form onSubmit={handleCreateGiftCodeSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        কোড নাম (Code) *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCodeName}
                        onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                        placeholder="যেমন: BONUS100 বা TASK2026"
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold uppercase tracking-wider outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        রিওয়ার্ডের ধরণ (Type) *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewCodeType('coins')}
                          className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                            newCodeType === 'coins'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          🪙 কয়েন (Coins)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewCodeType('balance')}
                          className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                            newCodeType === 'balance'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          ৳ নগদ ব্যালেন্স (Cash)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        রিওয়ার্ড পরিমাণ (Amount) *
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        required
                        min={1}
                        max={100000}
                        value={newCodeAmount}
                        onChange={(e) => setNewCodeAmount(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {newCodeType === 'coins' ? 'ইউজার কয়েন ওয়ালেটে যুক্ত হবে' : 'ইউজারের উত্তোলনযোগ্য ব্যালেন্সে নগদ টাকা যুক্ত হবে'}
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        বিবরণ (Description)
                      </label>
                      <input
                        type="text"
                        value={newCodeDesc}
                        onChange={(e) => setNewCodeDesc(e.target.value)}
                        placeholder="যেমন: ১০০ কয়েন স্পেশাল সাইনআপ রিওয়ার্ড"
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        সর্বোচ্চ কতজন ব্যবহার করতে পারবে? (Usage Limit)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        onWheel={(e) => e.currentTarget.blur()}
                        min={1}
                        value={newCodeMaxUses}
                        onChange={(e) => setNewCodeMaxUses(e.target.value)}
                        placeholder="যেমন: 500 বা 1000 (খালি রাখলে সীমাহীন)"
                        className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-amber-500"
                      />
                      {/* Quick Usage Limit Presets */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { label: '১০০ জন', val: '100' },
                          { label: '৫০০ জন', val: '500' },
                          { label: '১০০০ জন', val: '1000' },
                          { label: 'সীমাহীন', val: '' }
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setNewCodeMaxUses(preset.val)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              newCodeMaxUses === preset.val
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500/50'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingGiftCode}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isCreatingGiftCode ? 'তৈরি হচ্ছে...' : 'গিফট কোড সেভ ও লাইভ করুন'}</span>
                    </button>
                  </form>
                </div>

                {/* List: All Gift Codes */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-400" />
                      <h4 className="font-extrabold text-sm text-white">সচল ও সংরক্ষিত গিফট কোডসমূহ</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      মোট: {giftCodes.length} টি কোড
                    </span>
                  </div>

                  {giftCodes.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-xl space-y-2">
                      <Gift className="w-8 h-8 mx-auto text-slate-600" />
                      <div className="text-xs font-bold text-slate-300">এখনো কোনো গিফট কোড তৈরি করা হয়নি</div>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        বামপাশের ফর্মটি পূরণ করে যেকোনো সময় নতুন গিফট কোড যোগ করতে পারেন।
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                      {giftCodes.map((gc) => {
                        const isLimitReached = Boolean(gc.maxUses && gc.timesUsed >= gc.maxUses);
                        const progressPct = gc.maxUses ? Math.min(100, Math.round((gc.timesUsed / gc.maxUses) * 100)) : 0;

                        return (
                          <div
                            key={gc.id}
                            className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-400 font-mono font-black text-xs tracking-wider">
                                  {gc.code}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    gc.type === 'coins'
                                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  }`}
                                >
                                  {gc.type === 'coins' ? `+${gc.amount} কয়েন` : `+৳${gc.amount} নগদ`}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isLimitReached
                                      ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                      : gc.active
                                      ? 'bg-emerald-900/60 text-emerald-300'
                                      : 'bg-rose-900/60 text-rose-300'
                                  }`}
                                >
                                  {isLimitReached
                                    ? 'লিমিট পূর্ণ — স্বয়ংক্রিয়ভাবে নিষ্ক্রিয়'
                                    : gc.active
                                    ? 'সক্রিয় (Active)'
                                    : 'নিষ্ক্রিয় (Disabled)'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-300 truncate">
                                {gc.description || 'প্রমোশনাল গিফট রিওয়ার্ড'}
                              </p>

                              <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                                <span>ব্যবহার হয়েছে: <strong className="text-white font-mono">{gc.timesUsed}</strong> জন</span>
                                {gc.maxUses ? (
                                  <span>সর্বোচ্চ সীমা: <strong className="text-amber-300 font-mono">{gc.maxUses}</strong> জন ({progressPct}%)</span>
                                ) : (
                                  <span className="text-slate-500">সীমা: সীমাহীন</span>
                                )}
                              </div>

                              {gc.maxUses && (
                                <div className="w-full max-w-xs h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      isLimitReached ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                                    }`}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleToggleGiftCodeStatus(gc.id, gc.active)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  gc.active
                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                }`}
                              >
                                {gc.active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                              </button>

                              {confirmDeleteGiftId === gc.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGiftCode(gc.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                                  >
                                    নিশ্চিত মুছুন
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteGiftId(null)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                                  >
                                    বাতিল
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { playSound('click'); setConfirmDeleteGiftId(gc.id); }}
                                  className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800 transition-colors cursor-pointer"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 10: HISTORY & ARCHIVE SECTION (PROCESSED WITHDRAWALS + RESOLVED COMPLAINTS & APPEALS) */}
          {activeTab === 'history_archive' && (
            <div className="space-y-5">
              {/* Header Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/50 border border-cyan-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 shadow-inner">
                    <Archive className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-base sm:text-lg text-white">
                        হিস্ট্রি ও আর্কাইভ (History / Archive)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                        মোট {totalArchivedCount} টি রেকর্ড
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      অনুমোদিত ও বাতিলকৃত পেমেন্ট এবং সমাধানকৃত অভিযোগ ও আপিলসমূহ এখানে পরিপাটিভাবে সংরক্ষিত থাকে।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                    <span className="text-slate-400">উইথড্রয়াল: </span>
                    <strong className="text-emerald-400 font-mono">{processedWithdrawals.length}</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                    <span className="text-slate-400">টাস্ক সাবমিশন: </span>
                    <strong className="text-cyan-400 font-mono">{archivedProofs.length}</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                    <span className="text-slate-400">অভিযোগ: </span>
                    <strong className="text-teal-400 font-mono">{resolvedComplaints.length}</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
                    <span className="text-slate-400">আপিল: </span>
                    <strong className="text-rose-400 font-mono">{resolvedAppeals.length}</strong>
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: `সকল (${totalArchivedCount})` },
                    { id: 'proofs', label: `টাস্ক সাবমিশন (${archivedProofs.length})` },
                    { id: 'withdrawals', label: `প্রসেসকৃত উইথড্রয়াল (${processedWithdrawals.length})` },
                    { id: 'complaints', label: `সমাধানকৃত অভিযোগ (${resolvedComplaints.length})` },
                    { id: 'appeals', label: `সমাধানকৃত আপিল (${resolvedAppeals.length})` }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setArchiveFilter(f.id as 'all' | 'withdrawals' | 'proofs' | 'complaints' | 'appeals');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        archiveFilter === f.id
                          ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={archiveSearch}
                    onChange={(e) => setArchiveSearch(e.target.value)}
                    placeholder="নাম, নম্বর, TrxID বা ID খুঁজুন..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500"
                  />
                  {archiveSearch && (
                    <button
                      type="button"
                      onClick={() => setArchiveSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const q = archiveSearch.trim().toLowerCase();
                const archivedProofsList = (archiveFilter === 'all' || archiveFilter === 'proofs')
                  ? archivedProofs.filter(prf =>
                      !q ||
                      prf.id.toLowerCase().includes(q) ||
                      prf.jobTitle.toLowerCase().includes(q) ||
                      prf.workerName.toLowerCase().includes(q) ||
                      prf.workerPhone.toLowerCase().includes(q) ||
                      prf.proofText.toLowerCase().includes(q)
                    )
                  : [];

                const archivedWithdrawalsList = (archiveFilter === 'all' || archiveFilter === 'withdrawals')
                  ? processedWithdrawals.filter(w =>
                      !q ||
                      w.id.toLowerCase().includes(q) ||
                      w.userName.toLowerCase().includes(q) ||
                      w.accountNumber.toLowerCase().includes(q) ||
                      (w.trxId || '').toLowerCase().includes(q)
                    )
                  : [];

                const archivedComplaintsList = (archiveFilter === 'all' || archiveFilter === 'complaints')
                  ? resolvedComplaints.filter(fb =>
                      !q ||
                      fb.id.toLowerCase().includes(q) ||
                      fb.userName.toLowerCase().includes(q) ||
                      fb.userPhone.toLowerCase().includes(q) ||
                      fb.message.toLowerCase().includes(q)
                    )
                  : [];

                const archivedAppealsList = (archiveFilter === 'all' || archiveFilter === 'appeals')
                  ? resolvedAppeals.filter(fb =>
                      !q ||
                      fb.id.toLowerCase().includes(q) ||
                      fb.userName.toLowerCase().includes(q) ||
                      fb.userPhone.toLowerCase().includes(q) ||
                      fb.message.toLowerCase().includes(q)
                    )
                  : [];

                const hasAnyItems =
                  archivedProofsList.length > 0 ||
                  archivedWithdrawalsList.length > 0 ||
                  archivedComplaintsList.length > 0 ||
                  archivedAppealsList.length > 0;

                if (!hasAnyItems) {
                  return (
                    <div className="text-center py-14 text-slate-400 bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl space-y-2">
                      <Archive className="w-10 h-10 text-slate-600 mx-auto" />
                      <h4 className="font-bold text-sm text-slate-300">আর্কাইভে কোনো মিল থাকা রেকর্ড পাওয়া যায়নি</h4>
                      <p className="text-xs text-slate-500">
                        টাস্ক সাবমিশন আর্কাইভ, উইথড্রয়াল প্রসেস বা অভিযোগ/আপিল সমাধান করার পর তা এখানে সংরক্ষিত হবে।
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Archived Task Submissions */}
                    {archivedProofsList.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>আর্কাইভকৃত টাস্ক সাবমিশন ({archivedProofsList.length})</span>
                        </h4>
                        <div className="space-y-2.5">
                          {archivedProofsList.map((prf) => {
                            const isBusy = archivingProofId === prf.id;
                            return (
                              <div
                                key={prf.id}
                                className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-indigo-400 text-xs">#{prf.id}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      prf.status === 'approved'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                                    }`}>
                                      {prf.status === 'approved' ? '✓ অনুমোদিত ও পেইড' : '✗ প্রত্যাখ্যাত'}
                                    </span>
                                    {prf.archivedAt && (
                                      <span className="text-[10px] text-slate-400">আর্কাইভ: {prf.archivedAt}</span>
                                    )}
                                  </div>
                                  <div className="text-xs sm:text-sm font-bold text-white break-words">
                                    {prf.jobTitle}
                                  </div>
                                  <div className="text-xs text-slate-300 break-words">
                                    ওয়ার্কার: <strong>{prf.workerName}</strong> (<span className="font-mono break-all">{prf.workerPhone}</span>) · রিওয়ার্ড: <strong className="text-emerald-400 font-mono">৳{prf.reward}</strong>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2 rounded-xl border border-slate-800 break-words">
                                    প্রমাণ: "{prf.proofText}"
                                  </div>
                                </div>

                                {onArchiveProof && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setArchivingProofId(prf.id);
                                      playSound('click');
                                      try {
                                        await onArchiveProof(prf.id, false);
                                      } finally {
                                        setArchivingProofId(null);
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>{isBusy ? 'অপেক্ষা করুন...' : 'পুনরুদ্ধার'}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Archived Withdrawals */}
                    {archivedWithdrawalsList.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>প্রসেসকৃত উইথড্রয়াল আর্কাইভ ({archivedWithdrawalsList.length})</span>
                        </h4>
                        <div className="space-y-2.5">
                          {archivedWithdrawalsList.map((w) => (
                            <div
                              key={w.id}
                              className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-indigo-400 text-xs">#{w.id}</span>
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-700">
                                    {w.method} ({w.accountType})
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    w.status === 'approved'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                                  }`}>
                                    {w.status === 'approved' ? '✓ পেমেন্ট সফল' : '✗ বাতিল ও রিফান্ডেড'}
                                  </span>
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-white">
                                  {w.userName} • <span className="font-mono text-emerald-400">{w.accountNumber}</span>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                                  <span>পরিমাণ: <strong className="text-emerald-400">৳{w.amount}</strong></span>
                                  <span>তারিখ: {w.date}</span>
                                  {w.trxId && <span>TrxID: <strong className="font-mono text-indigo-300">{w.trxId}</strong></span>}
                                  {w.rejectReason && <span className="text-rose-400">কারণ: {w.rejectReason}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Archived Resolved Complaints */}
                    {archivedComplaintsList.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>সমাধানকৃত অভিযোগ ও পরামর্শ আর্কাইভ ({archivedComplaintsList.length})</span>
                        </h4>
                        <div className="space-y-2.5">
                          {archivedComplaintsList.map((fb) => (
                            <div
                              key={fb.id}
                              className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-indigo-400 font-bold">#{fb.id}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    ✓ সমাধানকৃত
                                  </span>
                                  <span className="text-xs font-bold text-white">{fb.userName}</span>
                                  <span className="text-xs font-mono text-slate-400">({fb.userPhone})</span>
                                </div>
                                <span className="text-[11px] text-slate-400">{fb.date}</span>
                              </div>
                              <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                                {fb.message}
                              </p>
                              {fb.adminReply && (
                                <div className="text-xs text-emerald-300 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/50">
                                  <strong>অ্যাডমিন সমাধান:</strong> {fb.adminReply}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Archived Resolved Appeals */}
                    {archivedAppealsList.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>সমাধানকৃত ব্লকড অ্যাকাউন্ট আপিল আর্কাইভ ({archivedAppealsList.length})</span>
                        </h4>
                        <div className="space-y-2.5">
                          {archivedAppealsList.map((fb) => (
                            <div
                              key={fb.id}
                              className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-indigo-400 font-bold">#{fb.id}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    ✓ আপিল নিষ্পত্তিকৃত
                                  </span>
                                  <span className="text-xs font-bold text-white">{fb.userName}</span>
                                  <span className="text-xs font-mono text-slate-400">({fb.userPhone})</span>
                                </div>
                                <span className="text-[11px] text-slate-400">{fb.date}</span>
                              </div>
                              <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                                {fb.message}
                              </p>
                              {fb.adminReply && (
                                <div className="text-xs text-emerald-300 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/50">
                                  <strong>অ্যাডমিন সমাধান:</strong> {fb.adminReply}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: DIRECT SUPPORT MESSAGES INBOX */}
          {activeTab === 'support_messages' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/50 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
                      <span>সরাসরি সাপোর্ট মেসেজ ইনবক্স (Support Messages)</span>
                      {newSupportMessagesCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-black">
                          {newSupportMessagesCount} টি নতুন
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Contact &amp; Support ফর্ম থেকে সংরক্ষিত সকল সরাসরি মেসেজ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-300 font-mono">
                    মোট: <strong className="text-white">{supportMessages.length}</strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300 font-mono">
                    নতুন: <strong>{newSupportMessagesCount}</strong>
                  </span>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'all', label: `সবগুলো (${supportMessages.length})` },
                  { key: 'new', label: `নতুন (${supportMessages.filter(m => m.status === 'new').length})` },
                  { key: 'read', label: `পঠিত (${supportMessages.filter(m => m.status === 'read').length})` },
                  { key: 'resolved', label: `সমাধানকৃত (${supportMessages.filter(m => m.status === 'resolved').length})` }
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setSupportMsgFilter(item.key as 'all' | 'new' | 'read' | 'resolved');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      supportMsgFilter === item.key
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {(() => {
                const filteredMessages = supportMessages.filter(m =>
                  supportMsgFilter === 'all' ? true : m.status === supportMsgFilter
                );

                if (filteredMessages.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 space-y-2">
                      <Mail className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                      <div className="text-sm font-bold text-slate-200">
                        এই ক্যাটাগরিতে কোনো সাপোর্ট মেসেজ নেই
                      </div>
                      <p className="text-xs text-slate-500">
                        ব্যবহারকারীরা Contact &amp; Support ফর্ম থেকে মেসেজ পাঠালে এখানে সরাসরি দেখা যাবে।
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredMessages.map(msg => {
                      const isBusy = updatingSupportMsgId === msg.id;
                      const isConfirmingDelete = confirmDeleteSupportMsgId === msg.id;
                      return (
                        <div
                          key={msg.id}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 shadow-sm ${
                            msg.status === 'new'
                              ? 'bg-slate-800/95 border-emerald-500/50'
                              : 'bg-slate-800/70 border-slate-700/80'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-indigo-400 font-bold">
                                  #{msg.id}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    msg.status === 'new'
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                      : msg.status === 'read'
                                        ? 'bg-sky-950 text-sky-300 border-sky-700'
                                        : 'bg-teal-950 text-teal-300 border-teal-700'
                                  }`}
                                >
                                  {msg.status === 'new'
                                    ? '● নতুন বার্তা'
                                    : msg.status === 'read'
                                      ? '👁 পঠিত (Read)'
                                      : '✓ সমাধানকৃত (Resolved)'}
                                </span>
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{msg.date}</span>
                                </span>
                              </div>

                              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                                <span>{msg.userName}</span>
                                <span className="text-xs font-mono text-emerald-400 bg-slate-900/90 px-2.5 py-0.5 rounded-md border border-slate-700">
                                  {msg.contact}
                                </span>
                              </div>

                              <div className="text-xs font-bold text-amber-300">
                                বিষয়: {msg.subject}
                              </div>

                              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                {msg.message}
                              </div>
                            </div>

                            {/* Admin Actions: Mark Read / Mark Resolved / Delete */}
                            <div className="flex flex-row sm:flex-col gap-2 shrink-0 flex-wrap">
                              {msg.status === 'new' && onUpdateSupportMessageStatus && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    playSound('click');
                                    setUpdatingSupportMsgId(msg.id);
                                    try {
                                      await onUpdateSupportMessageStatus(msg.id, 'read');
                                    } finally {
                                      setUpdatingSupportMsgId(null);
                                    }
                                  }}
                                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>পঠিত চিহ্নিত করুন</span>
                                </button>
                              )}

                              {msg.status !== 'resolved' && onUpdateSupportMessageStatus && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    playSound('success');
                                    setUpdatingSupportMsgId(msg.id);
                                    try {
                                      await onUpdateSupportMessageStatus(msg.id, 'resolved');
                                    } finally {
                                      setUpdatingSupportMsgId(null);
                                    }
                                  }}
                                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  <span>সমাধানকৃত</span>
                                </button>
                              )}

                              {onDeleteSupportMessage && !isConfirmingDelete && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    playSound('click');
                                    setConfirmDeleteSupportMsgId(msg.id);
                                  }}
                                  className="px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-700/60 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>ডিলিট</span>
                                </button>
                              )}

                              {onDeleteSupportMessage && isConfirmingDelete && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      playSound('error');
                                      setUpdatingSupportMsgId(msg.id);
                                      try {
                                        await onDeleteSupportMessage(msg.id);
                                      } finally {
                                        setUpdatingSupportMsgId(null);
                                        setConfirmDeleteSupportMsgId(null);
                                      }
                                    }}
                                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                                  >
                                    নিশ্চিত ডিলিট
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteSupportMsgId(null)}
                                    className="px-2.5 py-2 rounded-xl bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                                  >
                                    না
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: ADS MANAGER (অ্যাড ম্যানেজমেন্ট -> siteSettings/adsConfig) */}
          {activeTab === 'ads_manager' && (
            <form onSubmit={handleSaveAdsSettings} className="space-y-5">
              {/* Header */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-950/60 via-slate-900 to-fuchsia-950/50 border border-violet-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-500/40 text-violet-300 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
                      <span>অ্যাড ম্যানেজমেন্ট (Ads Manager)</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          adsEnabledDraft
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {adsEnabledDraft ? 'GLOBAL ON' : 'GLOBAL OFF'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Firestore (<span className="font-mono text-violet-300">siteSettings/adsConfig</span>) এর মাধ্যমে রিডেপ্লয় ছাড়াই লাইভ অ্যাড নিয়ন্ত্রণ করুন
                    </p>
                  </div>
                </div>

                {/* Global Enable / Disable Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={adsEnabledDraft}
                  onClick={() => {
                    playSound('click');
                    setAdsEnabledDraft(prev => !prev);
                    setAdsNotice(null);
                  }}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all cursor-pointer shrink-0 ${
                    adsEnabledDraft
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span>{adsEnabledDraft ? 'সব অ্যাড চালু (Enabled)' : 'সব অ্যাড বন্ধ (Disabled)'}</span>
                  <span
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                      adsEnabledDraft ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow" />
                  </span>
                </button>
              </div>

              {/* Section 1: Smart Link / Direct Link URL */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/75 border border-slate-700/80 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        ১. Smart Link / Direct Link URL
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        যেমন: Adsterra Smart Link — ড্যাশবোর্ড ও মাইক্রো-জবস সেকশনে "Sponsored / বিজ্ঞাপন" বাটন হিসেবে দেখাবে
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={smartLinkEnabledDraft}
                      onClick={() => {
                        playSound('click');
                        setSmartLinkEnabledDraft(prev => !prev);
                        setAdsNotice(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                        smartLinkEnabledDraft
                          ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span>{smartLinkEnabledDraft ? 'চালু (ON)' : 'বন্ধ (OFF)'}</span>
                      <span
                        className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                          smartLinkEnabledDraft ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setSmartLinkUrlDraft('');
                        setSmartLinkEnabledDraft(false);
                        setAdsNotice({
                          text: 'Smart Link মুছে ফেলা হয়েছে। স্থায়ীভাবে আপডেট করতে নিচে "Save Ads Settings" ক্লিক করুন। / Smart Link cleared. Click Save Ads Settings to apply.',
                          isError: false
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-700/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Clear Smart Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন / Clear</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="url"
                    value={smartLinkUrlDraft}
                    onChange={e => {
                      setSmartLinkUrlDraft(e.target.value);
                      if (adsNotice) setAdsNotice(null);
                    }}
                    placeholder="https://www.profitablecpmrate.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-violet-500 text-xs sm:text-sm font-mono text-white outline-none"
                  />
                  {smartLinkUrlDraft.trim() && sanitizeExternalHttpUrl(smartLinkUrlDraft) && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 px-1">
                      <span>✓ বৈধ URL ফরম্যাট শনাক্ত হয়েছে</span>
                      <a
                        href={sanitizeExternalHttpUrl(smartLinkUrlDraft)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200 underline"
                      >
                        <span>টেস্ট লিংক দেখুন</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Banner / Native Banner Ad Code */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/75 border border-slate-700/80 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        ২. Banner / Native Banner Ad Code (HTML/Script)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Adsterra বা যেকোনো নেটওয়ার্কের HTML/Script ব্যানার কোড পেস্ট করুন — নিরাপদ স্যান্ডবক্সে নিচের সেকশনে প্রদর্শিত হবে
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={bannerEnabledDraft}
                      onClick={() => {
                        playSound('click');
                        setBannerEnabledDraft(prev => !prev);
                        setAdsNotice(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                        bannerEnabledDraft
                          ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span>{bannerEnabledDraft ? 'চালু (ON)' : 'বন্ধ (OFF)'}</span>
                      <span
                        className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                          bannerEnabledDraft ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setBannerCodeDraft('');
                        setBannerEnabledDraft(false);
                        setAdsNotice({
                          text: 'ব্যানার অ্যাড কোড মুছে ফেলা হয়েছে। স্থায়ীভাবে আপডেট করতে নিচে "Save Ads Settings" ক্লিক করুন। / Banner code cleared. Click Save Ads Settings to apply.',
                          isError: false
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-700/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Clear Banner Code"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন / Clear</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={6}
                  maxLength={20000}
                  value={bannerCodeDraft}
                  onChange={e => {
                    setBannerCodeDraft(e.target.value);
                    if (adsNotice) setAdsNotice(null);
                  }}
                  placeholder={'<script async="async" data-cfasync="false" src="//..."></script>\n<div id="container-..."></div>'}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 text-xs font-mono text-cyan-100 outline-none leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>অক্ষর সংখ্যা: {bannerCodeDraft.trim().length} / 20,000</span>
                  <span>Math / Quiz / Captcha প্রশ্নের ওপর কখনোই জোরপূর্বক অ্যাড দেখানো হবে না</span>
                </div>
              </div>

              {/* Feedback Message */}
              {adsNotice && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-start gap-2.5 ${
                    adsNotice.isError
                      ? 'bg-rose-950/60 border-rose-700 text-rose-300'
                      : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                  }`}
                >
                  {adsNotice.isError ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{adsNotice.text}</span>
                </div>
              )}

              {/* Save Action Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="text-xs text-slate-400">
                  লাইভ স্ট্যাটাস:{' '}
                  <strong className={adsConfig.adsEnabled ? 'text-emerald-400' : 'text-slate-300'}>
                    {adsConfig.adsEnabled ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}
                  </strong>
                  {' · '}
                  Smart Link:{' '}
                  <strong className={adsConfig.adsEnabled && adsConfig.smartLinkEnabled && adsConfig.smartLinkUrl ? 'text-amber-400' : 'text-slate-400'}>
                    {adsConfig.adsEnabled && adsConfig.smartLinkEnabled && adsConfig.smartLinkUrl ? 'Live' : 'Hidden'}
                  </strong>
                  {' · '}
                  Banner:{' '}
                  <strong className={adsConfig.adsEnabled && adsConfig.bannerEnabled && adsConfig.bannerCode.trim() ? 'text-cyan-400' : 'text-slate-400'}>
                    {adsConfig.adsEnabled && adsConfig.bannerEnabled && adsConfig.bannerCode.trim() ? 'Live' : 'Hidden'}
                  </strong>
                </div>

                <button
                  type="submit"
                  disabled={isSavingAds}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingAds
                      ? 'সেভ হচ্ছে... (Saving...)'
                      : 'Save Ads Settings (অ্যাড সেটিংস সেভ করুন)'}
                  </span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* RETURN TO OVERVIEW DASHBOARD CONTROL WHEN INSIDE ANY SUB-TAB */}
        {activeTab !== 'dashboard' && (
          <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              onClick={() => { playSound('click'); setActiveTab('dashboard'); }}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-purple-600/30"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>← মূল এডমিন প্যানেল (মেনু ও ওভারভিউ ড্যাশবোর্ড)</span>
            </button>
            <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {activeTab.toUpperCase()} • BINDED SESSION
            </div>
          </div>
        )}

      </div>

      {/* MASTER PIN CHANGE MODAL (DIRECT CLOUD SAVE) */}
      {showPinModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="relative my-auto w-full max-w-[400px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] overflow-y-auto bg-slate-900 border border-amber-500/40 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-sm text-white">
                  মাস্টার পিন / পাসওয়ার্ড পরিবর্তন
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setPinMessage(null);
                }}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-white border border-slate-600 hover:border-rose-500 font-black text-xl leading-none flex items-center justify-center cursor-pointer transition-all"
                aria-label="Close Master PIN Modal"
                title="বন্ধ করুন (×)"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleDirectUpdateMasterPin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  বর্তমান মাস্টার পিন *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={16}
                  placeholder="বর্তমান পিন দিন"
                  value={currentPinInput}
                  onChange={(e) => {
                    setCurrentPinInput(e.target.value);
                    if (pinMessage) setPinMessage(null);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  নতুন মাস্টার পিন * (৪-১৬ সংখ্যা)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  minLength={4}
                  maxLength={16}
                  placeholder="নতুন গোপন পিন দিন"
                  value={newPinInput}
                  onChange={(e) => {
                    setNewPinInput(e.target.value);
                    if (pinMessage) setPinMessage(null);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  নতুন পিন নিশ্চিত করুন *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  minLength={4}
                  maxLength={16}
                  placeholder="নতুন পিন পুনরায় লিখুন"
                  value={confirmPinInput}
                  onChange={(e) => {
                    setConfirmPinInput(e.target.value);
                    if (pinMessage) setPinMessage(null);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              {pinMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${
                  pinMessage.isError ? 'bg-rose-950/60 text-rose-300 border border-rose-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                }`}>
                  {pinMessage.text}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPin}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isUpdatingPin ? 'সেভ হচ্ছে...' : 'নতুন পিন সংরক্ষণ করুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinMessage(null);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BLOCK USER CONFIRMATION MODAL */}
      {userToBlock && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="relative my-auto w-full max-w-[436px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] overflow-y-auto bg-slate-900 border border-rose-600/50 rounded-3xl p-5 space-y-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setUserToBlock(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-600 text-white border border-slate-600 hover:border-rose-500 font-black text-xl leading-none flex items-center justify-center cursor-pointer transition-all"
              aria-label="Close Block User Modal"
              title="বন্ধ করুন (×)"
            >
              &times;
            </button>
            <div className="w-12 h-12 rounded-2xl bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-base text-white">
                ইউজার অ্যাকাউন্ট ব্লক নিশ্চিতকরণ
              </h4>
              <p className="text-xs text-rose-300 font-semibold">
                ইউজার: {userToBlock.name} ({userToBlock.phone})
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                ব্লক করার সাথে সাথে এই ইউজারের বর্তমান সেশন তাৎক্ষণিকভাবে বাতিল (Auto-Logout) হবে এবং তিনি কোনো কার্যক্রম চালাতে পারবেন না।
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                ব্লক করার কারণ নির্বাচন করুন:
              </label>
              <select
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-rose-500"
              >
                <option value="সন্দেহজনক কার্যকলাপ ও পলিসি লঙ্ঘন">সন্দেহজনক কার্যকলাপ ও পলিসি লঙ্ঘন</option>
                <option value="ভুল তথ্য বা একাধিক ডুপ্লিকেট অ্যাকাউন্ট">ভুল তথ্য বা একাধিক ডুপ্লিকেট অ্যাকাউন্ট</option>
                <option value="লেনদেন ও পেমেন্ট অসঙ্গতি">লেনদেন ও পেমেন্ট অসঙ্গতি</option>
                <option value="অ্যাডমিন কর্তৃক অ্যাকাউন্ট সাময়িক স্থগিত">অ্যাডমিন কর্তৃক অ্যাকাউন্ট সাময়িক স্থগিত</option>
              </select>
              
              <input
                type="text"
                placeholder="অথবা নিজস্ব কারণ লিখুন (ঐচ্ছিক)..."
                value={customBlockReason}
                onChange={(e) => setCustomBlockReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExecuteBlock}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>হ্যাঁ, এখনই ব্লক ও লগআউট করুন</span>
              </button>
              <button
                onClick={() => setUserToBlock(null)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
