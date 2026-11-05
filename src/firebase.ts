import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import type { UserHistoryItem, TariffConfig } from './types';

// Fallback configuration for project cd048fae-0d90-4965-bcf0-644f67b0a949
const DEFAULT_FIREBASE_SETTINGS = {
  projectId: 'gen-lang-client-0500905516',
  appId: '1:554783610759:web:5d8123715acab0d65ce522',
  apiKey: 'AIzaSyASNFHzPzR9MHVY82F9NYG4S710zPqth_s',
  authDomain: 'gen-lang-client-0500905516.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-cd048fae-0d90-4965-bcf0-644f67b0a949',
  storageBucket: 'gen-lang-client-0500905516.firebasestorage.app',
  messagingSenderId: '554783610759'
};

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_SETTINGS.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_SETTINGS.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_SETTINGS.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_SETTINGS.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || DEFAULT_FIREBASE_SETTINGS.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_SETTINGS.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_SETTINGS.messagingSenderId,
};

// Initialize or reuse Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Specify firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per SKILL.md requirement
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network restricted:', error.message);
    }
    return false;
  }
}

/**
 * Translates Firebase Auth error codes into clear, actionable advice for users and deployment targets
 */
export function formatAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  const hostname = window.location.hostname;

  if (code === 'auth/unauthorized-domain') {
    return `Domain "${hostname}" is not authorized in Firebase Auth. To allow sign-in from your Vercel deployment, add "${hostname}" in Firebase Console > Authentication > Settings > Authorized domains.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'The sign-in popup was blocked by your browser. Please allow popups for this site and click Google Login again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'The Google sign-in window was closed before completing.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'A popup request was already in progress.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network request failed. Please check your internet connection.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google provider is not enabled in Firebase Authentication console.';
  }
  return error?.message || 'Authentication encountered an unexpected error.';
}

// Sign in with Google
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Sync user profile document (wrapped safely so network/permission glitches don't break login)
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Campus Energy Manager',
        photoURL: user.photoURL || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (profileErr) {
      console.warn('Profile sync notice:', profileErr);
    }

    return user;
  } catch (err: any) {
    console.error('Google sign-in error:', err);
    throw err;
  }
}

// Sign out
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Save analysis run to history (Firestore)
export async function saveHistoryToFirestore(userId: string, item: Omit<UserHistoryItem, 'userId'>): Promise<void> {
  const path = `users/${userId}/history`;
  try {
    const itemRef = doc(db, path, item.id);
    await setDoc(itemRef, {
      ...item,
      userId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${item.id}`);
  }
}

// Fetch user history (Firestore)
export async function fetchUserHistory(userId: string): Promise<UserHistoryItem[]> {
  const path = `users/${userId}/history`;
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as UserHistoryItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Delete user history entry (Firestore)
export async function deleteHistoryEntry(userId: string, historyId: string): Promise<void> {
  const path = `users/${userId}/history/${historyId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'history', historyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Save user tariff config (Firestore)
export async function saveTariffToFirestore(userId: string, tariff: TariffConfig): Promise<void> {
  const path = `users/${userId}/tariffs/${tariff.id}`;
  try {
    const tariffRef = doc(db, 'users', userId, 'tariffs', tariff.id);
    await setDoc(tariffRef, {
      id: tariff.id,
      userId,
      name: tariff.name,
      peakRate: tariff.peakRate,
      normalRate: tariff.normalRate,
      offPeakRate: tariff.offPeakRate,
      fixedMonthlyCharge: tariff.fixedMonthlyCharge,
      demandChargePerKw: tariff.demandChargePerKw,
      taxPercentage: tariff.taxPercentage,
      peakHours: tariff.peakHours,
      offPeakHours: tariff.offPeakHours,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch user tariffs (Firestore)
export async function fetchUserTariffs(userId: string): Promise<TariffConfig[]> {
  const path = `users/${userId}/tariffs`;
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'tariffs'));
    return snapshot.docs.map(d => d.data() as TariffConfig);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Local Storage utilities for Guest/Offline operation
const LOCAL_STORAGE_HISTORY_KEY = 'poweroptima_guest_history';
const LOCAL_STORAGE_TARIFFS_KEY = 'poweroptima_guest_tariffs';

export function getLocalHistory(): UserHistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalHistory(item: UserHistoryItem): UserHistoryItem[] {
  try {
    const current = getLocalHistory();
    const updated = [item, ...current.filter(i => i.id !== item.id)];
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteLocalHistory(historyId: string): UserHistoryItem[] {
  try {
    const current = getLocalHistory();
    const updated = current.filter(i => i.id !== historyId);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getLocalTariffs(): TariffConfig[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TARIFFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTariff(tariff: TariffConfig): TariffConfig[] {
  try {
    const current = getLocalTariffs();
    const updated = [...current.filter(t => t.id !== tariff.id), tariff];
    localStorage.setItem(LOCAL_STORAGE_TARIFFS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// Save user monthly budget (Firestore)
export async function saveUserBudgetToFirestore(userId: string, email: string, monthlyBudget: number): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      userId,
      email: email || '',
      monthlyBudget,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch user profile / budget (Firestore)
export async function fetchUserProfile(userId: string): Promise<{ monthlyBudget?: number } | null> {
  const path = `users/${userId}`;
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    return userSnap.exists() ? (userSnap.data() as any) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Local Storage for monthly budget
const LOCAL_STORAGE_BUDGET_KEY = 'poweroptima_monthly_budget';

export function getLocalBudget(): number {
  try {
    const val = localStorage.getItem(LOCAL_STORAGE_BUDGET_KEY);
    return val ? Number(val) : 350000;
  } catch {
    return 350000;
  }
}

export function saveLocalBudget(budget: number): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_BUDGET_KEY, String(budget));
  } catch {}
}
