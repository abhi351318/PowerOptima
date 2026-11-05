import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  testConnection,
  loginWithGoogle,
  logoutUser,
  fetchUserHistory,
  saveHistoryToFirestore,
  deleteHistoryEntry,
  fetchUserTariffs,
  saveTariffToFirestore
} from '../firebase';
import type { UserHistoryItem, TariffConfig } from '../types';
import { DEFAULT_TARIFF } from '../utils/sampleData';

interface AuthContextType {
  user: User | null;
  isLoadingAuth: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  historyItems: UserHistoryItem[];
  savedTariffs: TariffConfig[];
  activeTariff: TariffConfig;
  setActiveTariff: (tariff: TariffConfig) => void;
  targetBudget: number;
  setTargetBudget: (budget: number) => void;
  saveHistorySnapshot: (item: Omit<UserHistoryItem, 'userId'>) => Promise<void>;
  deleteHistory: (historyId: string) => Promise<void>;
  saveCustomTariff: (tariff: TariffConfig) => Promise<void>;
  isFirebaseConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [historyItems, setHistoryItems] = useState<UserHistoryItem[]>([]);
  const [savedTariffs, setSavedTariffs] = useState<TariffConfig[]>([DEFAULT_TARIFF]);
  const [activeTariff, setActiveTariff] = useState<TariffConfig>(DEFAULT_TARIFF);
  const [targetBudget, setTargetBudget] = useState<number>(350000); // ₹3.5 Lakh default
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);

  // Boot test connection per SKILL.md
  useEffect(() => {
    testConnection().then((ok) => {
      setIsFirebaseConnected(ok);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
      if (currentUser) {
        try {
          const [history, tariffs] = await Promise.all([
            fetchUserHistory(currentUser.uid),
            fetchUserTariffs(currentUser.uid)
          ]);
          setHistoryItems(history);
          if (tariffs && tariffs.length > 0) {
            setSavedTariffs([DEFAULT_TARIFF, ...tariffs]);
            setActiveTariff(tariffs[0]);
          }
        } catch (err) {
          console.warn('Could not load user data from Firestore:', err);
        }
      } else {
        setHistoryItems([]);
        setSavedTariffs([DEFAULT_TARIFF]);
        setActiveTariff(DEFAULT_TARIFF);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Failed to log in with Google', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Failed to log out', err);
    }
  };

  const saveHistorySnapshot = async (item: Omit<UserHistoryItem, 'userId'>) => {
    if (!user) {
      // Local fallback in case user hasn't signed in yet
      const localItem: UserHistoryItem = { ...item, userId: 'guest' };
      setHistoryItems((prev) => [localItem, ...prev]);
      return;
    }

    await saveHistoryToFirestore(user.uid, item);
    const updated = await fetchUserHistory(user.uid);
    setHistoryItems(updated);
  };

  const deleteHistory = async (historyId: string) => {
    if (user) {
      await deleteHistoryEntry(user.uid, historyId);
      setHistoryItems((prev) => prev.filter((i) => i.id !== historyId));
    } else {
      setHistoryItems((prev) => prev.filter((i) => i.id !== historyId));
    }
  };

  const saveCustomTariff = async (tariff: TariffConfig) => {
    if (user) {
      await saveTariffToFirestore(user.uid, tariff);
      const tariffs = await fetchUserTariffs(user.uid);
      setSavedTariffs([DEFAULT_TARIFF, ...tariffs]);
    } else {
      setSavedTariffs((prev) => [...prev.filter((t) => t.id !== tariff.id), tariff]);
    }
    setActiveTariff(tariff);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoadingAuth,
        login,
        logout,
        historyItems,
        savedTariffs,
        activeTariff,
        setActiveTariff,
        targetBudget,
        setTargetBudget,
        saveHistorySnapshot,
        deleteHistory,
        saveCustomTariff,
        isFirebaseConnected
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
