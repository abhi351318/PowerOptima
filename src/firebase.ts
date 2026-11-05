import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { UserHistoryItem, TariffConfig } from './types';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
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
      console.warn("Client appears offline or check Firebase configuration:", error.message);
    }
    return false;
  }
}

// Sign in with Google
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Sync user profile document
    const user = result.user;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Campus Energy Manager',
      photoURL: user.photoURL || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return user;
  } catch (err) {
    console.error("Google sign-in error", err);
    throw err;
  }
}

// Sign out
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Save analysis run to history
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

// Fetch user history
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

// Delete user history entry
export async function deleteHistoryEntry(userId: string, historyId: string): Promise<void> {
  const path = `users/${userId}/history/${historyId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'history', historyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Save user tariff config
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

// Fetch user tariffs
export async function fetchUserTariffs(userId: string): Promise<TariffConfig[]> {
  const path = `users/${userId}/tariffs`;
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'tariffs'));
    return snapshot.docs.map(d => d.data() as TariffConfig);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
