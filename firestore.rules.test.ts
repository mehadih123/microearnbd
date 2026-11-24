/**
 * Adversarial Firestore Security Rules Test Suite ("Dirty Dozen" Verification)
 * Target Ruleset: firestore.rules
 * Project: taskvaultbd
 */
import { readFileSync } from 'node:fs';

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation & Initial Balance Spoof on User Registration',
    collectionPath: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      uid: 'user_1',
      name: 'Attacker',
      role: 'admin',
      balance: 99999,
      pendingEscrowBalance: 0,
      coins: 0,
      memberTier: 'Verified',
      isBlocked: false,
      joinedDate: 'Today'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Unverified Bootstrapped Admin Email Spoof Attack',
    collectionPath: '/products/prod_spoof',
    operation: 'create',
    auth: { uid: 'spoof_uid', email: 'mdmehadih181@gmail.com', email_verified: false },
    payload: {
      id: 'prod_spoof',
      title: 'Fake Product',
      titleEn: 'Fake Product',
      category: 'gadget',
      customerPrice: 500,
      commission: 100,
      deliveryChargeInside: 60,
      deliveryChargeOutside: 120,
      image: 'https://example.com/p.jpg',
      description: 'Desc',
      features: ['Fast'],
      status: 'published',
      authorId: 'spoof_uid'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Shadow / Ghost Field Injection on User Update',
    collectionPath: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      coins: 50,
      isSuperAdmin: true
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Cross-User PII Scraping on Isolated Private Subcollection',
    collectionPath: '/users/user_2/private/pii',
    operation: 'get',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Non-Atomic User Creation Without Private PII Subdocument',
    collectionPath: '/users/user_solo',
    operation: 'create',
    auth: { uid: 'user_solo', email: 'solo@example.com', email_verified: true },
    payload: {
      uid: 'user_solo',
      name: 'Solo',
      role: 'user',
      balance: 0,
      pendingEscrowBalance: 0,
      coins: 0,
      memberTier: 'Verified',
      isBlocked: false,
      joinedDate: 'Today'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Unauthorized Product Creation by Non-Admin User',
    collectionPath: '/products/prod_unauth',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'prod_unauth',
      title: 'Item',
      titleEn: 'Item',
      category: 'medicine',
      customerPrice: 300,
      commission: 50,
      deliveryChargeInside: 60,
      deliveryChargeOutside: 120,
      image: 'https://example.com/img.png',
      description: 'Valid desc',
      features: ['Authentic'],
      status: 'published',
      authorId: 'user_1'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Path Variable ID Poisoning Attack',
    collectionPath: '/products/invalid$id!spaces',
    operation: 'get',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Value Poisoning (+50000 Coin Jump in Single Mutation)',
    collectionPath: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      coins: 50000
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Forged Client Timestamp on Withdrawal Creation',
    collectionPath: '/withdrawals/wdr_forged_time',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'wdr_forged_time',
      userId: 'user_1',
      userName: 'User One',
      userPhone: '01700000000',
      method: 'bKash Personal',
      accountType: 'personal',
      accountNumber: '01700000000',
      amount: 200,
      date: 'Today',
      status: 'pending',
      createdAt: '1999-01-01T00:00:00Z',
      updatedAt: '1999-01-01T00:00:00Z'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Orphaned Order Referencing Non-Existent Product',
    collectionPath: '/orders/ord_orphan',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'ord_orphan',
      userId: 'user_1',
      productId: 'missing_product_999',
      productTitle: 'Ghost',
      productImage: 'https://example.com/a.jpg',
      customerName: 'Cust',
      customerPhone: '01711111111',
      customerAddress: 'Dhaka, Bangladesh',
      cityType: 'inside_dhaka',
      sellingPrice: 500,
      commission: 100,
      status: 'pending_courier',
      escrowReleased: false,
      resellerName: 'User',
      date: 'Today'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Terminal State Mutation on Approved Withdrawal',
    collectionPath: '/withdrawals/wdr_completed',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      amount: 50000,
      status: 'pending'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Unfiltered Collection List Scraping on Withdrawals',
    collectionPath: '/withdrawals',
    operation: 'list',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  }
];

export function verifyRulesStaticAssertions(rulesPath = './firestore.rules'): boolean {
  const rules = readFileSync(rulesPath, 'utf8');
  const requiredGuards = [
    "rules_version = '2';",
    'match /{document=**} {',
    'allow read, write: if false;',
    'request.auth.token.email_verified == true',
    'existsAfter(/databases/$(database)/documents/users/$(userId)/private/pii)',
    'isValidUserProfile(incoming())',
    'isValidProduct(incoming())',
    'isValidOrder(incoming())',
    'isValidWithdrawal(incoming())',
    'isValidTaskProof(incoming())',
    'isValidFeedback(incoming())',
    'isValidTransaction(incoming())',
    'isValidSupportMessage(incoming())',
    'isValidAdsConfig(incoming())'
  ];
  for (const guard of requiredGuards) {
    if (!rules.includes(guard)) {
      throw new Error(`Missing mandatory security guard in rules: ${guard}`);
    }
  }
  return true;
}
