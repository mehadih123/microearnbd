// TaskVault BD: Safe User Account & Profile Cleanup Script
// Safely clears previously registered standard user accounts from Firestore
// Preserves the Super Admin account (mdmehadih181@gmail.com) and all system collections.

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const ADMIN_EMAIL = 'mdmehadih181@gmail.com';

async function runCleanup() {
  console.log('🧹 Starting safe user accounts cleanup in Firestore...');
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);

  let deleted = 0;
  let preserved = 0;

  for (const uDoc of snap.docs) {
    const data = uDoc.data();
    const uid = uDoc.id;
    const isAdmin = data.role === 'admin' || (data.email && data.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (isAdmin) {
      console.log(`🛡️ Preserving Super Admin: ${uid} (${data.name || 'Admin'})`);
      preserved++;
      continue;
    }

    try {
      await deleteDoc(doc(db, 'users', uid, 'private', 'pii'));
    } catch {}

    await deleteDoc(doc(db, 'users', uid));
    deleted++;
    console.log(`✓ Deleted old user profile: ${uid} (${data.name || 'User'})`);
  }

  console.log(`\n🎉 Cleanup complete: ${deleted} old users deleted, ${preserved} admin(s) preserved.`);
}

runCleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
