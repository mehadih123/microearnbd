import { Product, MicroJob, Transaction, NotificationItem, Order, TaskProofSubmission, UserAccount, WithdrawalRequest, FeedbackItem } from '../types';

// Clean production state: NO pre-seeded demo accounts
export const INITIAL_USERS: UserAccount[] = [];

export const INITIAL_WITHDRAWAL_REQUESTS: WithdrawalRequest[] = [];

export const INITIAL_FEEDBACK_ITEMS: FeedbackItem[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

// Clean production state: NO hardcoded, dummy, or sample micro-tasks
export const INITIAL_MICRO_JOBS: MicroJob[] = [];

export const INITIAL_PROOF_SUBMISSIONS: TaskProofSubmission[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-welcome',
    title: 'MicroEarn BD তে স্বাগতম!',
    message: 'ম্যাথ টাস্ক ও কুইজ জব সমাধান করে ৫০ কয়েন করে আয় করুন এবং ১,০০০ কয়েনে ৳১.০০ মূল ওয়ালেটে কনভার্ট করুন।',
    time: 'এইমাত্র',
    type: 'earning',
    read: false
  }
];
