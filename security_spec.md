# TaskVault BD — Phase 0 Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unspecified Firestore paths default to `allow read, write: if false`.
2. **Verified Identity Enforcement**: Every write operation mandates `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero-Spoof Admin Gate**: `isAdmin()` verifies either an explicit `/admins/{uid}` document OR the bootstrapped admin email `mdmehadih181@gmail.com` strictly combined with `request.auth.token.email_verified == true`. Users cannot self-assign `role: 'admin'` in `/users/{userId}`.
4. **PII Split Isolation (Pillar 6)**: User email and phone PII are isolated into `/users/{userId}/private/pii`, synced atomically via `existsAfter` (Pillar 7) with parent `/users/{userId}` (Pillar 1 Master Gate), and readable solely by `isOwner(userId)` or `isAdmin()`.
5. **Global Product Catalog Integrity**: Only verified Admins can `create`, `update`, or `delete` documents in `/products/{productId}`. Clients read published products (`status == 'published'`) with strict `resource.data.status == 'published'` query enforcement (Pillar 8) and zero `get()`/`exists()` inside `allow list`.
6. **Wallet & Coin Anti-Tamper**: Users cannot set arbitrary `balance` on registration (`balance == 0`, `pendingEscrowBalance == 0`), cannot increment coins by more than `+50` per task action, and can only convert `1000` coins into `+1` BDT when `existing().coins >= 1000`.
7. **Relational Parent Existence**: Orders require existing `/users/{uid}` and `/products/{productId}`; TaskProofs require existing `/users/{uid}` and `/jobs/{jobId}`; Withdrawals, Feedbacks, and Transactions require existing `/users/{uid}`.
8. **Terminal State Locking & Temporal Integrity**: Completed/rejected/cancelled records in `orders`, `withdrawals`, `proofs`, `jobs`, and `feedbacks` are locked against further non-admin updates, and all `createdAt`/`updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Payloads (Adversarial Test Vectors)
1. **Payload 1 — Privilege Escalation on Registration**: Authenticated user creates `/users/{uid}` with `"role": "admin"` or `"balance": 99999`. -> `PERMISSION_DENIED`.
2. **Payload 2 — Unverified Admin Email Spoofing**: Attacker authenticates with `email: "mdmehadih181@gmail.com"` and `email_verified: false` and attempts to create `/products/prod-hack`. -> `PERMISSION_DENIED`.
3. **Payload 3 — Shadow / Ghost Field Injection**: User updates `/users/{uid}` with valid `coins` plus undeclared field `"isVerified": true`. -> `PERMISSION_DENIED`.
4. **Payload 4 — PII Cross-User Scraping**: User A (`uid_a`) attempts `get` or `list` on `/users/uid_b/private/pii`. -> `PERMISSION_DENIED`.
5. **Payload 5 — Orphaned User Creation Without Atomic PII Split (Pillar 7)**: User creates `/users/{uid}` without atomically creating `/users/{uid}/private/pii` in the same batch. -> `PERMISSION_DENIED`.
6. **Payload 6 — Unauthorized Non-Admin Product Upload**: Regular verified user attempts to write a new product to `/products/prod-1`. -> `PERMISSION_DENIED`.
7. **Payload 7 — ID Poisoning / Resource Exhaustion (Pillar 3)**: Attacker targets `/products/bad$id!with spaces` or injects a 500KB title string. -> `PERMISSION_DENIED`.
8. **Payload 8 — Value Poisoning on Update (Pillar 2)**: User updates `/users/{uid}` `coins` field with a string `"1000000"` or jumps `coins` by `+50000` in one write. -> `PERMISSION_DENIED`.
9. **Payload 9 — Forged Client Timestamp**: User creates `/withdrawals/wdr-1` with a past/future `createdAt` timestamp instead of `request.time`. -> `PERMISSION_DENIED`.
10. **Payload 10 — Orphaned Order Creation**: User submits `/orders/ord-1` referencing non-existent `/products/non-existent-prod`. -> `PERMISSION_DENIED`.
11. **Payload 11 — Terminal State Mutation**: User or attacker attempts to mutate a withdrawal already in `status: "approved"` or `"rejected"`. -> `PERMISSION_DENIED`.
12. **Payload 12 — Blanket List Scraping**: Authenticated user executes an unfiltered `getDocs(collection(db, 'withdrawals'))` to scrape other users' bKash numbers. -> `PERMISSION_DENIED`.

## 3. Verification Test Runner
Implemented in `/firestore.rules.test.ts` validating that all 12 Dirty Dozen payloads evaluate to `PERMISSION_DENIED`.
