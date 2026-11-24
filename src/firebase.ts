import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  User,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  enableNetwork,
  doc,
  collection,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  where,
  runTransaction,
  onSnapshot,
  type DocumentReference,
  type DocumentData,
  type DocumentSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  Product,
  Order,
  MicroJob,
  Transaction,
  UserAccount,
  TaskProofSubmission,
  WithdrawalRequest,
  FeedbackItem,
  SupportMessageItem,
  GiftCode,
  AdsConfig
} from './types';

// Initialize Firebase App, Firestore (with provisioned named database ID & long-polling resilience), and Auth
const app = initializeApp(firebaseConfig);
function createFirestoreClient() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}
export const db = createFirestoreClient();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAPPED_ADMIN_EMAIL = 'mdmehadih181@gmail.com';

export function isAuthorizedAdminUser(fbUser: User | null = auth.currentUser): boolean {
  if (!fbUser) return false;
  const isGoogleUser = Boolean(fbUser.providerData?.some(p => p.providerId === 'google.com'));
  if (!fbUser.emailVerified && !isGoogleUser) return false;
  return (fbUser.email || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
}

export function assertAuthorizedAdmin(): User {
  const fbUser = auth.currentUser;
  if (!isAuthorizedAdminUser(fbUser)) {
    throw new Error(
      `অননুমোদিত প্রবেশাধিকার! শুধুমাত্র নির্ধারিত অ্যাডমিন জিমেইল (${BOOTSTRAPPED_ADMIN_EMAIL}) দিয়ে লগইন করলে এটি করা যাবে।`
    );
  }
  return fbUser!;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isOfflineOrUnavailableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || '';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('the client is offline') ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('failed to get document because the client is offline')
  );
}

async function getDocWithOfflineRetry(
  ref: DocumentReference<DocumentData>
): Promise<DocumentSnapshot<DocumentData>> {
  try {
    return await getDoc(ref);
  } catch (firstErr) {
    if (!isOfflineOrUnavailableError(firstErr)) {
      throw firstErr;
    }
    try {
      await enableNetwork(db).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 650));
      return await getDoc(ref);
    } catch (retryErr) {
      if (isOfflineOrUnavailableError(retryErr)) {
        try {
          return await getDocFromCache(ref);
        } catch {
          throw retryErr;
        }
      }
      throw retryErr;
    }
  }
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// ============================================================================
// DEFENSIVE PAYLOAD SANITIZATION & IMAGE COMPRESSION HELPERS
// ============================================================================
export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

function truncateStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export async function compressProductImage(rawImage: string): Promise<string> {
  const trimmed = rawImage.trim();
  if (!trimmed.startsWith('data:image/') || trimmed.length <= 140000) {
    return trimmed.slice(0, 179000);
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const tryCompress = (maxDim: number, quality: number): string => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.max(1, Math.round((height * maxDim) / width));
              width = maxDim;
            } else {
              width = Math.max(1, Math.round((width * maxDim) / height));
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return '';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          return canvas.toDataURL('image/jpeg', quality);
        };

        let compressed = tryCompress(640, 0.72);
        if (compressed.length > 170000) {
          compressed = tryCompress(520, 0.55);
        }
        if (compressed.length > 170000) {
          compressed = tryCompress(380, 0.45);
        }
        resolve(compressed || trimmed.slice(0, 179000));
      } catch {
        resolve(trimmed.slice(0, 179000));
      }
    };
    img.onerror = () => resolve(trimmed.slice(0, 179000));
    img.src = trimmed;
  });
}

// ============================================================================
// PENDING SIGNUP PROFILE HELPER (PRESERVES NAME/PHONE ACROSS MOBILE EMAIL LINK VERIFICATION)
// ============================================================================
const PENDING_SIGNUP_STORAGE_KEY = 'microearnbd_pending_signup_profile';

export function savePendingSignupProfile(data: { email: string; name: string; phone: string }): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      PENDING_SIGNUP_STORAGE_KEY,
      JSON.stringify({
        email: data.email.trim().toLowerCase(),
        name: data.name.trim(),
        phone: data.phone.replace(/[^0-9+-]/g, '').slice(0, 20),
        savedAt: Date.now()
      })
    );
  } catch {
    // Ignore storage errors
  }
}

export function readPendingSignupProfile(email?: string | null): { name?: string; phone?: string } | null {
  try {
    if (typeof window === 'undefined' || !email) return null;
    const raw = localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; name?: string; phone?: string; savedAt?: number };
    if (!parsed?.email || parsed.email.toLowerCase() !== email.trim().toLowerCase()) {
      return null;
    }
    return {
      name: parsed.name || undefined,
      phone: parsed.phone || undefined
    };
  } catch {
    return null;
  }
}

export function clearPendingSignupProfile(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

// ============================================================================
// USER PROFILE + ISOLATED PII ATOMIC BOOTSTRAP & READ
// ============================================================================
export async function ensureFirestoreUserProfile(
  fbUser: User,
  extra?: { name?: string; phone?: string; guestCoins?: number; referredBy?: string }
): Promise<UserAccount | null> {
  const uid = sanitizeId(fbUser.uid);
  const userPath = `users/${uid}`;
  const piiPath = `users/${uid}/private/pii`;

  // Google users are pre-verified; Email/Password accounts require verification
  const isGoogleUser = Boolean(fbUser.providerData?.some(p => p.providerId === 'google.com'));
  if (!fbUser.emailVerified && !isGoogleUser) {
    return null;
  }

  let profileSnap;
  try {
    profileSnap = await getDocWithOfflineRetry(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const isBootstrappedAdmin =
    (Boolean(fbUser.emailVerified) || isGoogleUser) &&
    (fbUser.email || '').toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  const pendingSignup = readPendingSignupProfile(fbUser.email);
  const resolvedExtraName = extra?.name || pendingSignup?.name;
  const resolvedExtraPhone = extra?.phone || pendingSignup?.phone;

  if (!profileSnap.exists()) {
    const safeName = truncateStr(
      resolvedExtraName || fbUser.displayName || fbUser.email?.split('@')[0] || 'MicroEarn Member',
      100,
      'MicroEarn Member'
    );
    const safeEmail = truncateStr(fbUser.email || 'user@microearnbd.com', 160, 'user@microearnbd.com');
    const cleanPhone = (resolvedExtraPhone || '').replace(/[^0-9+-]/g, '').slice(0, 20);
    const initialCoins = Math.min(5000, Math.max(0, Math.floor(extra?.guestCoins || 0)));
    const joinedDate =
      'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
    const refCode = uid.slice(0, 8).toUpperCase();
    const storedRef = extra?.referredBy || (typeof window !== 'undefined' ? localStorage.getItem('taskvault_ref') || '' : '');
    const cleanRef = storedRef.trim();
    const validRef = cleanRef && cleanRef !== refCode && cleanRef !== uid ? cleanRef : '';

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), {
      uid,
      name: safeName,
      role: isBootstrappedAdmin ? 'admin' : 'user',
      balance: 0,
      pendingEscrowBalance: 0,
      coins: initialCoins,
      memberTier: isBootstrappedAdmin ? 'মাস্টার অ্যাডমিন' : 'ভেরিফাইড মেম্বার',
      isBlocked: false,
      joinedDate: truncateStr(joinedDate, 80, 'আজ'),
      referralCode: refCode,
      referredBy: validRef,
      referralsCount: 0,
      referralEarnings: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(doc(db, 'users', uid, 'private', 'pii'), {
      uid,
      email: safeEmail,
      phone: cleanPhone,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
      clearPendingSignupProfile();

      // If referred by another user, increment their referral count
      if (validRef) {
        try {
          const referrerDocRef = doc(db, 'users', validRef);
          const referrerDocSnap = await getDoc(referrerDocRef);
          if (referrerDocSnap.exists()) {
            await updateDoc(referrerDocRef, {
              referralsCount: increment(1),
              updatedAt: serverTimestamp()
            });
          }
        } catch {
          // Non-critical referral increment
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return {
      id: uid,
      name: safeName,
      phone: cleanPhone,
      email: safeEmail,
      role: isBootstrappedAdmin ? 'admin' : 'user',
      balance: 0,
      pendingEscrowBalance: 0,
      coins: initialCoins,
      memberTier: isBootstrappedAdmin ? 'মাস্টার অ্যাডমিন' : 'ভেরিফাইড মেম্বার',
      isBlocked: false,
      joinedDate,
      referralCode: refCode,
      referredBy: validRef,
      referralsCount: 0,
      referralEarnings: 0
    };
  }

  const profileData = profileSnap.data();
  let email = fbUser.email || '';
  let phone = resolvedExtraPhone || '';

  try {
    const piiRef = doc(db, 'users', uid, 'private', 'pii');
    const piiSnap = await getDocWithOfflineRetry(piiRef);
    if (piiSnap.exists()) {
      const pii = piiSnap.data();
      email = (pii.email as string) || email;
      phone = (pii.phone as string) || phone;

      // Update phone if provided on login/signup and previously empty
      if (resolvedExtraPhone && !pii.phone) {
        const cleanPhone = resolvedExtraPhone.replace(/[^0-9+-]/g, '').slice(0, 20);
        await updateDoc(piiRef, {
          phone: cleanPhone,
          email: truncateStr(email || 'user@microearnbd.com', 160, 'user@microearnbd.com'),
          updatedAt: serverTimestamp()
        });
        phone = cleanPhone;
      }
      clearPendingSignupProfile();
    } else {
      const safeEmail = truncateStr(email || 'user@microearnbd.com', 160, 'user@microearnbd.com');
      const cleanPhone = (resolvedExtraPhone || '').replace(/[^0-9+-]/g, '').slice(0, 20);
      await setDoc(piiRef, {
        uid,
        email: safeEmail,
        phone: cleanPhone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      email = safeEmail;
      phone = cleanPhone;
      clearPendingSignupProfile();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, piiPath);
  }

  return {
    id: uid,
    name: (profileData.name as string) || fbUser.displayName || 'Member',
    phone,
    email,
    role: (profileData.role as 'user' | 'admin') || (isBootstrappedAdmin ? 'admin' : 'user'),
    balance: Number(profileData.balance || 0),
    pendingEscrowBalance: Number(profileData.pendingEscrowBalance || 0),
    coins: Number(profileData.coins || 0),
    memberTier: (profileData.memberTier as string) || 'ভেরিফাইড মেম্বার',
    isBlocked: Boolean(profileData.isBlocked),
    blockReason: profileData.blockReason as string | undefined,
    blockedAt: profileData.blockedAt as string | undefined,
    joinedDate: (profileData.joinedDate as string) || 'ভেরিফাইড',
    referralCode: (profileData.referralCode as string) || uid.slice(0, 8).toUpperCase(),
    referredBy: (profileData.referredBy as string) || undefined,
    referralsCount: Number(profileData.referralsCount || 0),
    referralEarnings: Number(profileData.referralEarnings || 0)
  };
}

// ============================================================================
// REAL-TIME GLOBAL PRODUCT OPERATIONS (ADMIN -> LIVE TO ALL CLIENTS)
// ============================================================================
export async function createFirestoreProduct(product: Product): Promise<void> {
  const adminUser = assertAuthorizedAdmin();
  const currentUid = adminUser.uid;

  const id = sanitizeId(product.id || `prod-${Date.now()}`);
  const path = `products/${id}`;
  const compressedImage = await compressProductImage(product.image);
  const safeFeatures = (product.features || [])
    .map(f => truncateStr(f, 120))
    .filter(Boolean)
    .slice(0, 15);

  const payload: Record<string, unknown> = {
    id,
    title: truncateStr(product.title, 200, 'পণ্য'),
    titleEn: truncateStr(product.titleEn || product.title, 200, 'Product'),
    category: truncateStr(product.category, 64, 'general'),
    customerPrice: Math.max(1, Math.min(10000000, Number(product.customerPrice) || 100)),
    commission: Math.max(0, Math.min(1000000, Number(product.commission) || 0)),
    deliveryChargeInside: Math.max(0, Math.min(10000, Number(product.deliveryChargeInside ?? 60))),
    deliveryChargeOutside: Math.max(0, Math.min(10000, Number(product.deliveryChargeOutside ?? 120))),
    image: compressedImage,
    description: truncateStr(
      product.description,
      2000,
      'অফিসিয়াল হোলসেল প্রোডাক্ট। ক্যাশ অন ডেলিভারি সুবিধা ও জিরো রিস্কে কমিশন।'
    ),
    features: safeFeatures.length > 0 ? safeFeatures : ['অরিজিনাল ও অথেনটিক'],
    status: 'published',
    authorId: sanitizeId(currentUid),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (typeof product.regularPrice === 'number') payload.regularPrice = product.regularPrice;
  if (typeof product.rating === 'number') payload.rating = Math.min(5, Math.max(0, product.rating));
  if (typeof product.soldCount === 'number') payload.soldCount = Math.max(0, Math.floor(product.soldCount));
  if (typeof product.stock === 'number') payload.stock = Math.max(0, Math.floor(product.stock));
  if (product.supplier) payload.supplier = truncateStr(product.supplier, 120);

  try {
    await setDoc(doc(db, 'products', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFirestoreProduct(product: Product): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(product.id);
  const path = `products/${id}`;
  const compressedImage = await compressProductImage(product.image);
  const safeFeatures = (product.features || [])
    .map(f => truncateStr(f, 120))
    .filter(Boolean)
    .slice(0, 15);

  const updates: Record<string, unknown> = {
    title: truncateStr(product.title, 200, 'পণ্য'),
    titleEn: truncateStr(product.titleEn || product.title, 200, 'Product'),
    category: truncateStr(product.category, 64, 'general'),
    customerPrice: Math.max(1, Math.min(10000000, Number(product.customerPrice) || 100)),
    commission: Math.max(0, Math.min(1000000, Number(product.commission) || 0)),
    deliveryChargeInside: Math.max(0, Math.min(10000, Number(product.deliveryChargeInside ?? 60))),
    deliveryChargeOutside: Math.max(0, Math.min(10000, Number(product.deliveryChargeOutside ?? 120))),
    image: compressedImage,
    description: truncateStr(
      product.description,
      2000,
      'অফিসিয়াল হোলসেল প্রোডাক্ট। ক্যাশ অন ডেলিভারি সুবিধা।'
    ),
    features: safeFeatures.length > 0 ? safeFeatures : ['অরিজিনাল ও অথেনটিক'],
    status: 'published',
    updatedAt: serverTimestamp()
  };

  try {
    await updateDoc(doc(db, 'products', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreProduct(productId: string): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(productId);
  const path = `products/${id}`;
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// USER WALLET, COINS & ADMIN USER MANAGEMENT
// ============================================================================
export async function incrementFirestoreUserCoins(uid: string, currentCoins: number): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      coins: Math.floor(currentCoins) + 50,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function convertFirestoreUserCoins(
  uid: string,
  currentCoins: number,
  currentBalance: number
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      coins: Math.floor(currentCoins) - 1000,
      balance: Number((currentBalance + 1).toFixed(2)),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreUserBalance(uid: string, nextBalance: number): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      balance: Math.max(0, Number(nextBalance.toFixed(2))),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function accrueFirestoreEscrowBalance(
  uid: string,
  nextEscrowBalance: number
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      pendingEscrowBalance: Math.max(0, Number(nextEscrowBalance.toFixed(2))),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminToggleFirestoreUserBlock(
  targetUser: UserAccount,
  shouldBlock: boolean,
  reason?: string
): Promise<void> {
  assertAuthorizedAdmin();
  const safeUid = sanitizeId(targetUser.id);
  const path = `users/${safeUid}`;
  const updates: Record<string, unknown> = {
    isBlocked: shouldBlock,
    blockReason: shouldBlock
      ? truncateStr(reason, 300, 'সন্দেহজনক কার্যকলাপ ও পলিসি লঙ্ঘন')
      : '',
    blockedAt: shouldBlock
      ? truncateStr(
          'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
          80,
          'আজ'
        )
      : '',
    updatedAt: serverTimestamp()
  };
  try {
    await updateDoc(doc(db, 'users', safeUid), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminAdjustFirestoreUserBalances(
  uid: string,
  fields: { balance?: number; pendingEscrowBalance?: number }
): Promise<void> {
  assertAuthorizedAdmin();
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof fields.balance === 'number') {
    updates.balance = Math.max(0, Number(fields.balance.toFixed(2)));
  }
  if (typeof fields.pendingEscrowBalance === 'number') {
    updates.pendingEscrowBalance = Math.max(0, Number(fields.pendingEscrowBalance.toFixed(2)));
  }
  try {
    await updateDoc(doc(db, 'users', safeUid), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// ORDERS, WITHDRAWALS, JOBS, PROOFS, FEEDBACKS & TRANSACTIONS
// ============================================================================
export async function createFirestoreOrder(order: Order, userId: string): Promise<void> {
  const id = sanitizeId(order.id);
  const path = `orders/${id}`;
  const compressedImg = await compressProductImage(order.productImage);
  try {
    await setDoc(doc(db, 'orders', id), {
      id,
      userId: sanitizeId(userId),
      productId: sanitizeId(order.productId),
      productTitle: truncateStr(order.productTitle, 300, 'পণ্য'),
      productImage: compressedImg,
      customerName: truncateStr(order.customerName, 100, 'কাস্টমার'),
      customerPhone: truncateStr(order.customerPhone, 20, '01700000000'),
      customerAddress: truncateStr(order.customerAddress, 400, 'ঢাকা'),
      cityType: order.cityType,
      sellingPrice: Math.max(1, Number(order.sellingPrice)),
      commission: Math.max(0, Number(order.commission)),
      status: 'pending_courier',
      escrowReleased: false,
      resellerName: truncateStr(order.resellerName, 100, 'রিসেলার'),
      date: truncateStr(order.date, 80, 'আজ'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateFirestoreOrder(
  orderId: string,
  fields: { status: Order['status']; escrowReleased?: boolean }
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(orderId);
  const path = `orders/${id}`;
  const updates: Record<string, unknown> = {
    status: fields.status,
    updatedAt: serverTimestamp()
  };
  if (typeof fields.escrowReleased === 'boolean') {
    updates.escrowReleased = fields.escrowReleased;
  }
  try {
    await updateDoc(doc(db, 'orders', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createFirestoreWithdrawal(req: WithdrawalRequest): Promise<void> {
  const id = sanitizeId(req.id);
  const path = `withdrawals/${id}`;
  const payload: Record<string, unknown> = {
    id,
    userId: sanitizeId(req.userId),
    userName: truncateStr(req.userName, 100, 'Member'),
    userPhone: truncateStr(req.userPhone, 20, '01700000000'),
    method: req.method,
    accountType: req.accountType,
    accountNumber: truncateStr(req.accountNumber, 20, '01700000000'),
    amount: Math.max(100, Number(req.amount)),
    date: truncateStr(req.date, 80, 'আজ'),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (req.trxId) payload.trxId = truncateStr(req.trxId, 64);

  try {
    await setDoc(doc(db, 'withdrawals', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminResolveFirestoreWithdrawal(
  withdrawalId: string,
  status: 'approved' | 'rejected',
  extra?: { trxId?: string; rejectReason?: string }
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(withdrawalId);
  const path = `withdrawals/${id}`;
  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp()
  };
  if (extra?.trxId) updates.trxId = truncateStr(extra.trxId, 64);
  if (extra?.rejectReason) updates.rejectReason = truncateStr(extra.rejectReason, 300);

  try {
    await updateDoc(doc(db, 'withdrawals', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createFirestoreMicroJob(job: MicroJob, authorId: string): Promise<void> {
  const id = sanitizeId(job.id);
  const path = `jobs/${id}`;
  const safeInstructions = (job.instructions || [])
    .map(i => truncateStr(i, 300))
    .filter(Boolean)
    .slice(0, 10);

  const payload: Record<string, unknown> = {
    id,
    title: truncateStr(job.title, 240, 'মাইক্রো জব'),
    category: job.category,
    platform: truncateStr(job.platform, 64, 'Social'),
    reward: Math.max(1, Number(job.reward)),
    estimatedTime: truncateStr(job.estimatedTime, 64, '২ মিনিট'),
    completedSlots: 0,
    totalSlots: Math.max(1, Math.floor(job.totalSlots || 10)),
    instructions: safeInstructions.length > 0 ? safeInstructions : ['নির্দেশনা অনুসরণ করুন'],
    proofPlaceholder: truncateStr(job.proofPlaceholder, 240, 'প্রুফ জমা দিন'),
    targetUrl: truncateStr(job.targetUrl, 500, 'https://youtube.com'),
    status: job.status,
    authorId: sanitizeId(authorId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (job.titleEn) payload.titleEn = truncateStr(job.titleEn, 240);
  if (typeof job.isUserGenerated === 'boolean') payload.isUserGenerated = job.isUserGenerated;
  if (job.postedBy) payload.postedBy = truncateStr(job.postedBy, 100);
  if (job.senderPhone) payload.senderPhone = truncateStr(job.senderPhone, 20);
  if (job.paymentTrxId) payload.paymentTrxId = truncateStr(job.paymentTrxId, 64);
  if (typeof job.totalBudget === 'number') payload.totalBudget = Math.max(0, job.totalBudget);

  try {
    await setDoc(doc(db, 'jobs', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateFirestoreJobStatus(
  jobId: string,
  status: MicroJob['status']
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(jobId);
  const path = `jobs/${id}`;
  try {
    await updateDoc(doc(db, 'jobs', id), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteFirestoreJob(jobId: string): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(jobId);
  const path = `jobs/${id}`;
  try {
    await deleteDoc(doc(db, 'jobs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function adminDeleteAllFirestoreJobs(): Promise<number> {
  assertAuthorizedAdmin();
  const path = 'jobs';
  try {
    const snap = await getDocs(collection(db, 'jobs'));
    if (snap.empty) return 0;

    let deleted = 0;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 400);
      for (const d of chunk) {
        batch.delete(d.ref);
        deleted++;
      }
      await batch.commit();
    }
    return deleted;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createFirestoreTaskProof(
  proof: TaskProofSubmission,
  workerId: string
): Promise<void> {
  const id = sanitizeId(proof.id);
  const path = `proofs/${id}`;
  try {
    await setDoc(doc(db, 'proofs', id), {
      id,
      jobId: sanitizeId(proof.jobId),
      jobTitle: truncateStr(proof.jobTitle, 240, 'টাস্ক'),
      workerId: sanitizeId(workerId),
      workerName: truncateStr(proof.workerName, 100, 'Worker'),
      workerPhone: truncateStr(proof.workerPhone, 20, 'N/A'),
      reward: Math.max(1, Number(proof.reward)),
      proofText: truncateStr(proof.proofText, 1000, 'Submitted'),
      submittedAt: truncateStr(proof.submittedAt, 80, 'এইমাত্র'),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateFirestoreProofStatus(
  proofId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(proofId);
  const path = `proofs/${id}`;
  try {
    await updateDoc(doc(db, 'proofs', id), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminArchiveFirestoreProof(
  proofId: string,
  archived = true
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(proofId);
  const path = `proofs/${id}`;
  const archivedAt = archived
    ? truncateStr(
        'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        80,
        'আজ'
      )
    : '';
  try {
    await updateDoc(doc(db, 'proofs', id), {
      archived,
      archivedAt,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createFirestoreFeedback(
  fb: FeedbackItem,
  userId: string
): Promise<void> {
  const id = sanitizeId(fb.id);
  const path = `feedbacks/${id}`;
  const payload: Record<string, unknown> = {
    id,
    userId: sanitizeId(userId),
    userName: truncateStr(fb.userName, 100, 'ইউজার'),
    userPhone: truncateStr(fb.userPhone || 'N/A', 100, 'N/A'),
    category: fb.category,
    subject: truncateStr(fb.subject, 200, 'সাপোর্ট বার্তা'),
    message: truncateStr(fb.message, 2000, 'বার্তা'),
    date: truncateStr(fb.date, 80, 'আজ'),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (fb.appealUserId) payload.appealUserId = sanitizeId(fb.appealUserId);

  try {
    await setDoc(doc(db, 'feedbacks', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminReplyFirestoreFeedback(
  feedbackId: string,
  reply: string
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(feedbackId);
  const path = `feedbacks/${id}`;
  try {
    await updateDoc(doc(db, 'feedbacks', id), {
      adminReply: truncateStr(reply, 2000, 'সমাধান করা হয়েছে'),
      status: 'resolved',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createFirestoreTransaction(
  tx: Transaction,
  userId: string
): Promise<void> {
  const id = sanitizeId(tx.id);
  const path = `transactions/${id}`;
  const payload: Record<string, unknown> = {
    id,
    userId: sanitizeId(userId),
    type: tx.type,
    title: truncateStr(tx.title, 240, 'লেনদেন'),
    amount: Math.max(0, Number(tx.amount)),
    date: truncateStr(tx.date, 80, 'আজ'),
    status: tx.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (tx.method) payload.method = truncateStr(tx.method, 32);
  if (tx.account) payload.account = truncateStr(tx.account, 32);
  if (tx.trxId) payload.trxId = truncateStr(tx.trxId, 64);

  try {
    await setDoc(doc(db, 'transactions', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getAdminPinFromFirestore(): Promise<string> {
  if (!isAuthorizedAdminUser()) {
    return '2026';
  }
  const ref = doc(db, 'settings', 'adminConfig');
  try {
    const serverSnap = await getDocFromServer(ref);
    if (serverSnap.exists() && typeof serverSnap.data().adminPin === 'string') {
      const val = (serverSnap.data().adminPin as string).trim();
      if (val) return val;
    }
    return '2026';
  } catch {
    try {
      const cacheSnap = await getDoc(ref);
      if (cacheSnap.exists() && typeof cacheSnap.data().adminPin === 'string') {
        const val = (cacheSnap.data().adminPin as string).trim();
        if (val) return val;
      }
    } catch {
      // Ignore cache error
    }
    return '2026';
  }
}

export async function saveAdminPinToFirestore(newPin: string): Promise<void> {
  const adminUser = assertAuthorizedAdmin();
  const currentUid = adminUser.uid;
  const path = 'settings/adminConfig';
  try {
    await setDoc(doc(db, 'settings', 'adminConfig'), {
      id: 'adminConfig',
      adminPin: truncateStr(newPin, 16, '2026'),
      updatedBy: currentUid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Safely delete / clear all previously registered user accounts and their associated profile data
 * from Firebase Firestore (users/{uid} and users/{uid}/private/pii).
 * Strictly protects the super-admin account (mdmehadih181@gmail.com / role === 'admin')
 * and never touches system collections or settings.
 */
export async function cleanupOldUserAccounts(): Promise<{ deletedCount: number; preservedCount: number }> {
  assertAuthorizedAdmin();
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    let deletedCount = 0;
    let preservedCount = 0;

    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      const uid = userDoc.id;
      const isAdmin =
        data.role === 'admin' ||
        (data.email && data.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) ||
        (auth.currentUser && auth.currentUser.uid === uid);

      if (isAdmin) {
        preservedCount++;
        continue;
      }

      // 1. Delete isolated private PII subcollection document
      try {
        const piiRef = doc(db, 'users', uid, 'private', 'pii');
        await deleteDoc(piiRef).catch(() => {});
      } catch {}

      // 2. Delete the root user profile document
      await deleteDoc(doc(db, 'users', uid));
      deletedCount++;
    }

    return { deletedCount, preservedCount };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'users');
    throw err;
  }
}

/**
 * Permanently deletes the current logged-in user's account from Firebase Auth and Firestore.
 * If user signed in with email/password, re-authenticates with provided password before deleting.
 */
export async function deleteCurrentUserAccount(password?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('কোনো সক্রিয় অ্যাকাউন্ট পাওয়া যায়নি');
  }

  const uid = user.uid;

  // Protect master admin from self-deletion
  if (user.email && user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('মাস্টার এডমিন অ্যাকাউন্ট স্থায়ীভাবে সংরক্ষিত, এটি ডিলিট করা সম্ভব নয়।');
  }

  // If password was provided and email exists, attempt reauthentication
  if (password && user.email) {
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } catch (err: unknown) {
      console.warn('Re-auth verification notice:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('ভুল পাসওয়ার্ড দিয়েছেন! আপনার একাউন্টের সঠিক পাসওয়ার্ড দিন।');
      }
    }
  }

  // 1. Delete private PII
  try {
    const piiRef = doc(db, 'users', uid, 'private', 'pii');
    await deleteDoc(piiRef).catch(() => {});
  } catch {}

  // 2. Delete main user document in Firestore
  try {
    await deleteDoc(doc(db, 'users', uid)).catch(() => {});
  } catch {}

  // 3. Delete from Firebase Authentication
  await deleteUser(user);
}

// ============================================================================
// DYNAMIC PROMOTIONAL GIFT CODES (ADMIN-MANAGED & USER REDEMPTION)
// ============================================================================
export async function createFirestoreGiftCode(gift: {
  code: string;
  type: 'coins' | 'balance';
  amount: number;
  description: string;
  maxUses?: number;
}): Promise<void> {
  assertAuthorizedAdmin();
  const cleanCode = gift.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  if (!cleanCode || cleanCode.length < 2) {
    throw new Error('গিফট কোড কমপক্ষে ২ অক্ষরের হতে হবে (যেমন: BONUS100)');
  }
  const path = `gift_codes/${cleanCode}`;
  const payload: Record<string, unknown> = {
    id: cleanCode,
    code: cleanCode,
    type: gift.type,
    amount: Math.min(100000, Math.max(1, Number(gift.amount))),
    description: truncateStr(gift.description, 240, 'প্রমোশনাল গিফট রিওয়ার্ড'),
    timesUsed: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (typeof gift.maxUses === 'number' && gift.maxUses > 0) {
    payload.maxUses = Math.floor(gift.maxUses);
  }
  try {
    await setDoc(doc(db, 'gift_codes', cleanCode), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFirestoreGiftCode(codeId: string): Promise<void> {
  assertAuthorizedAdmin();
  const safeId = sanitizeId(codeId.toUpperCase());
  const path = `gift_codes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'gift_codes', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleFirestoreGiftCode(codeId: string, active: boolean): Promise<void> {
  assertAuthorizedAdmin();
  const safeId = sanitizeId(codeId.toUpperCase());
  const path = `gift_codes/${safeId}`;
  try {
    await updateDoc(doc(db, 'gift_codes', safeId), {
      active,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function redeemFirestoreGiftCode(
  rawCode: string,
  userId: string
): Promise<{ success: boolean; message: string; type?: 'coins' | 'balance'; amount?: number; description?: string }> {
  const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  if (!cleanCode) {
    return { success: false, message: 'অনুগ্রহ করে একটি গিফট কোড লিখুন!' };
  }

  if (!auth.currentUser) {
    return { success: false, message: 'গিফট কোড রিডিম করতে আগে আপনার অ্যাকাউন্টে লগইন করুন!' };
  }

  const userSafeUid = sanitizeId(userId);
  const claimedKey = `taskvault_claimed_${userSafeUid}_${cleanCode}`;
  if (localStorage.getItem(claimedKey)) {
    return { success: false, message: 'আপনি ইতিমধ্যে এই গিফট কোডটি রিডিম করেছেন!' };
  }

  // Cross-device duplicate check against user's Firestore transactions
  const expectedTitle = `গিফট কোড রিওয়ার্ড (${cleanCode})`;
  try {
    const txSnap = await getDocs(
      query(collection(db, 'transactions'), where('userId', '==', userSafeUid))
    );
    const alreadyClaimedInCloud = txSnap.docs.some(d => {
      const txData = d.data();
      return txData.type === 'gift_code' && txData.title === expectedTitle;
    });
    if (alreadyClaimedInCloud) {
      localStorage.setItem(claimedKey, String(Date.now()));
      return { success: false, message: 'আপনি ইতিমধ্যে এই গিফট কোডটি ব্যবহার করেছেন!' };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transactions');
  }

  const giftRef = doc(db, 'gift_codes', cleanCode);
  const userRef = doc(db, 'users', userSafeUid);
  const txId = sanitizeId('TX-GIFT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900));
  const txRef = doc(db, 'transactions', txId);

  try {
    const result = await runTransaction(db, async transaction => {
      const giftSnap = await transaction.get(giftRef);
      const userSnap = await transaction.get(userRef);

      if (!giftSnap.exists()) {
        throw new Error('GIFT_NOT_FOUND');
      }

      const data = giftSnap.data();
      if (!data.active) {
        throw new Error('GIFT_INACTIVE');
      }

      const timesUsed = Number(data.timesUsed || 0);
      const maxUses = typeof data.maxUses === 'number' && data.maxUses > 0 ? data.maxUses : undefined;
      if (maxUses !== undefined && timesUsed >= maxUses) {
        throw new Error('GIFT_LIMIT_REACHED');
      }

      if (!userSnap.exists()) {
        throw new Error('USER_NOT_FOUND');
      }

      const userData = userSnap.data();
      if (userData.isBlocked) {
        throw new Error('USER_BLOCKED');
      }

      const rewardType: 'coins' | 'balance' = data.type === 'balance' ? 'balance' : 'coins';
      const rewardAmount = Math.min(100000, Math.max(1, Number(data.amount || 0)));
      const nextTimesUsed = timesUsed + 1;
      const shouldDeactivate = maxUses !== undefined && nextTimesUsed >= maxUses;

      // 1. Atomic increment & auto-deactivate when maxUses is reached
      transaction.update(giftRef, {
        timesUsed: nextTimesUsed,
        active: shouldDeactivate ? false : true,
        updatedAt: serverTimestamp()
      });

      // 2. Credit user coins or balance atomically
      if (rewardType === 'coins') {
        const currCoins = Math.floor(Number(userData.coins || 0));
        transaction.update(userRef, {
          coins: currCoins + Math.floor(rewardAmount),
          updatedAt: serverTimestamp()
        });
      } else {
        const currBal = Number(userData.balance || 0);
        const nextBal = Math.max(0, Number((currBal + rewardAmount).toFixed(2)));
        transaction.update(userRef, {
          balance: nextBal,
          updatedAt: serverTimestamp()
        });
      }

      // 3. Record transaction ledger entry atomically
      transaction.set(txRef, {
        id: txId,
        userId: userSafeUid,
        type: 'gift_code',
        title: truncateStr(expectedTitle, 240, 'গিফট কোড রিওয়ার্ড'),
        amount: rewardAmount,
        date: truncateStr(
          'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
          80,
          'আজ'
        ),
        status: 'completed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return {
        rewardType,
        rewardAmount,
        description: (data.description as string) || ''
      };
    });

    localStorage.setItem(claimedKey, String(Date.now()));

    const successMsg = result.rewardType === 'coins'
      ? `অভিনন্দন! "${cleanCode}" কোড সফলভাবে রিডিম হয়েছে। +${result.rewardAmount} কয়েন আপনার কয়েন ওয়ালেটে যুক্ত হয়েছে!`
      : `অভিনন্দন! "${cleanCode}" কোড সফলভাবে রিডিম হয়েছে। +৳${result.rewardAmount} নগদ টাকা আপনার মূল ব্যালেন্সে যুক্ত হয়েছে!`;

    return {
      success: true,
      message: successMsg,
      type: result.rewardType,
      amount: result.rewardAmount,
      description: result.description
    };
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'GIFT_NOT_FOUND') {
      return { success: false, message: 'অবৈধ গিফট কোড! কোডটি সঠিক কিনা যাচাই করুন অথবা অ্যাডমিনের নতুন কোডের জন্য অপেক্ষা করুন।' };
    }
    if (code === 'GIFT_INACTIVE') {
      return { success: false, message: 'এই গিফট কোডটি বর্তমানে নিষ্ক্রিয় রয়েছে!' };
    }
    if (code === 'GIFT_LIMIT_REACHED') {
      return { success: false, message: 'এই গিফট কোডটির সর্বোচ্চ ব্যবহারের সীমা শেষ হয়ে গেছে এবং স্বয়ংক্রিয়ভাবে বন্ধ হয়ে গেছে!' };
    }
    if (code === 'USER_NOT_FOUND') {
      return { success: false, message: 'ইউজার প্রোফাইল পাওয়া যায়নি। পুনরায় লগইন করে চেষ্টা করুন।' };
    }
    if (code === 'USER_BLOCKED') {
      return { success: false, message: 'আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত থাকায় গিফট কোড রিডিম করা সম্ভব নয়।' };
    }
    handleFirestoreError(err, OperationType.WRITE, `gift_codes/${cleanCode}`);
  }
}

// ============================================================================
// DIRECT SUPPORT MESSAGES INBOX (CONTACT & SUPPORT FORM -> ADMIN INBOX)
// ============================================================================
export async function createFirestoreSupportMessage(msg: SupportMessageItem): Promise<void> {
  const id = sanitizeId(msg.id);
  const path = `supportMessages/${id}`;
  const cleanContact = truncateStr(msg.contact, 120, 'N/A');
  const payload: Record<string, unknown> = {
    id,
    userName: truncateStr(msg.userName, 100, 'ব্যবহারকারী'),
    contact: cleanContact.length >= 3 ? cleanContact : 'N/A',
    subject: truncateStr(msg.subject, 200, 'সরাসরি সাপোর্ট মেসেজ'),
    message: truncateStr(msg.message, 2000, 'বার্তা'),
    status: 'new',
    date: truncateStr(msg.date, 80, 'আজ'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (auth.currentUser?.uid) {
    payload.userId = sanitizeId(auth.currentUser.uid);
  }

  try {
    await setDoc(doc(db, 'supportMessages', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateSupportMessageStatus(
  messageId: string,
  status: 'new' | 'read' | 'resolved'
): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(messageId);
  const path = `supportMessages/${id}`;
  try {
    await updateDoc(doc(db, 'supportMessages', id), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteSupportMessage(messageId: string): Promise<void> {
  assertAuthorizedAdmin();
  const id = sanitizeId(messageId);
  const path = `supportMessages/${id}`;
  try {
    await deleteDoc(doc(db, 'supportMessages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// DYNAMIC ADS MANAGER CONFIGURATION (siteSettings/adsConfig)
// ============================================================================
export const DEFAULT_ADS_CONFIG: AdsConfig = {
  adsEnabled: false,
  smartLinkEnabled: false,
  smartLinkUrl: '',
  bannerEnabled: false,
  bannerCode: ''
};

export function sanitizeExternalHttpUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString().slice(0, 1000);
  } catch {
    return '';
  }
}

export async function saveAdsConfigToFirestore(config: AdsConfig): Promise<AdsConfig> {
  const adminUser = assertAuthorizedAdmin();
  const path = 'siteSettings/adsConfig';
  const rawSmartUrl = (config.smartLinkUrl || '').trim();
  let safeSmartUrl = '';

  if (rawSmartUrl) {
    safeSmartUrl = sanitizeExternalHttpUrl(rawSmartUrl);
    if (!safeSmartUrl) {
      throw new Error(
        'অনুগ্রহ করে সঠিক Smart Link URL দিন (অবশ্যই http:// বা https:// দিয়ে শুরু হতে হবে)। / Please enter a valid http:// or https:// Smart Link URL.'
      );
    }
  }

  const cleanBannerCode = (config.bannerCode || '').trim().slice(0, 20000);

  const payload = {
    id: 'adsConfig',
    adsEnabled: Boolean(config.adsEnabled),
    smartLinkEnabled: Boolean(config.smartLinkEnabled),
    smartLinkUrl: safeSmartUrl,
    bannerEnabled: Boolean(config.bannerEnabled),
    bannerCode: cleanBannerCode,
    updatedBy: sanitizeId(adminUser.uid),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'siteSettings', 'adsConfig'), payload);
    return {
      adsEnabled: payload.adsEnabled,
      smartLinkEnabled: payload.smartLinkEnabled,
      smartLinkUrl: payload.smartLinkUrl,
      bannerEnabled: payload.bannerEnabled,
      bannerCode: payload.bannerCode,
      updatedBy: payload.updatedBy,
      updatedAtMs: Date.now()
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeAdsConfig(onUpdate: (config: AdsConfig) => void): () => void {
  const ref = doc(db, 'siteSettings', 'adsConfig');
  return onSnapshot(
    ref,
    snap => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_ADS_CONFIG);
        return;
      }
      const data = snap.data();
      const rawUrl = typeof data.smartLinkUrl === 'string' ? data.smartLinkUrl : '';
      const updatedAtMs =
        typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : undefined;

      onUpdate({
        adsEnabled: Boolean(data.adsEnabled),
        smartLinkEnabled: Boolean(data.smartLinkEnabled),
        smartLinkUrl: sanitizeExternalHttpUrl(rawUrl),
        bannerEnabled: Boolean(data.bannerEnabled),
        bannerCode: typeof data.bannerCode === 'string' ? data.bannerCode.slice(0, 20000) : '',
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
        updatedAtMs
      });
    },
    err => {
      console.warn('Ads config live listener notice:', err);
      onUpdate(DEFAULT_ADS_CONFIG);
    }
  );
}

