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
  saveTariffToFirestore,
  formatAuthErrorMessage,
  getLocalHistory,
  saveLocalHistory,
  deleteLocalHistory,
  getLocalTariffs,
  saveLocalTariff,
  getLocalBudget,
  saveLocalBudget,
  saveUserBudgetToFirestore,
  fetchUserProfile
} from '../firebase';
import type { UserHistoryItem, TariffConfig } from '../types';
import { DEFAULT_TARIFF } from '../utils/sampleData';

interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  isLoadingAuth: boolean;
  login: () => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  historyItems: UserHistoryItem[];
  savedTariffs: TariffConfig[];
  activeTariff: TariffConfig;
  setActiveTariff: (tariff: TariffConfig) => void;
  targetBudget: number;
  setTargetBudget: (budget: number) => void;
  updateTargetBudget: (budget: number) => Promise<void>;
  saveHistorySnapshot: (item: Omit<UserHistoryItem, 'userId'>) => Promise<void>;
  deleteHistory: (historyId: string) => Promise<void>;
  saveCustomTariff: (tariff: TariffConfig) => Promise<void>;
  isFirebaseConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<UserHistoryItem[]>([]);
  const [savedTariffs, setSavedTariffs] = useState<TariffConfig[]>([DEFAULT_TARIFF]);
  const [activeTariff, setActiveTariff] = useState<TariffConfig>(DEFAULT_TARIFF);
  const [targetBudget, setTargetBudget] = useState<number>(() => getLocalBudget());
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);

  // Initial load and connection testing
  useEffect(() => {
    testConnection().then((ok) => {
      setIsFirebaseConnected(ok);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);

      if (currentUser) {
        setIsGuest(false);
        try {
          const [history, tariffs, profile] = await Promise.all([
            fetchUserHistory(currentUser.uid),
            fetchUserTariffs(currentUser.uid),
            fetchUserProfile(currentUser.uid)
          ]);

          if (profile && typeof profile.monthlyBudget === 'number' && profile.monthlyBudget > 0) {
            setTargetBudget(profile.monthlyBudget);
            saveLocalBudget(profile.monthlyBudget);
          } else {
            setTargetBudget(getLocalBudget());
          }

          // Combine with any local offline history
          const localItems = getLocalHistory();
          const mergedHistory = [...(history || [])];
          for (const item of localItems) {
            if (!mergedHistory.some((h) => h.id === item.id)) {
              mergedHistory.push({ ...item, userId: currentUser.uid });
            }
          }
          setHistoryItems(mergedHistory);

          if (tariffs && tariffs.length > 0) {
            setSavedTariffs([DEFAULT_TARIFF, ...tariffs]);
            setActiveTariff(tariffs[0]);
          }
        } catch (err) {
          console.warn('Could not load user data from Firestore:', err);
          setHistoryItems(getLocalHistory());
          setTargetBudget(getLocalBudget());
        }
      } else {
        // Unauthenticated or Guest
        setHistoryItems(getLocalHistory());
        setTargetBudget(getLocalBudget());
        const localTariffs = getLocalTariffs();
        if (localTariffs.length > 0) {
          setSavedTariffs([DEFAULT_TARIFF, ...localTariffs]);
          setActiveTariff(localTariffs[0]);
        } else {
          setSavedTariffs([DEFAULT_TARIFF]);
          setActiveTariff(DEFAULT_TARIFF);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
      setIsGuest(false);
    } catch (err: any) {
      const friendlyMessage = formatAuthErrorMessage(err);
      setAuthError(friendlyMessage);
      throw err;
    }
  };

  const loginAsGuest = () => {
    setIsGuest(true);
    setAuthError(null);
  };

  const logout = async () => {
    try {
      await logoutUser();
      setIsGuest(false);
      setHistoryItems(getLocalHistory());
      setTargetBudget(getLocalBudget());
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const updateTargetBudget = async (newBudget: number) => {
    const validAmount = Math.max(1000, Math.round(newBudget));
    setTargetBudget(validAmount);
    saveLocalBudget(validAmount);

    if (user) {
      try {
        await saveUserBudgetToFirestore(user.uid, user.email || '', validAmount);
      } catch (err) {
        console.warn('Could not persist budget to Firestore:', err);
      }
    }
  };

  const saveHistorySnapshot = async (item: Omit<UserHistoryItem, 'userId'>) => {
    const fullItem: UserHistoryItem = {
      ...item,
      userId: user?.uid || (isGuest ? 'guest' : 'local')
    };

    // Always preserve in local storage
    saveLocalHistory(fullItem);

    if (user) {
      try {
        await saveHistoryToFirestore(user.uid, item);
        const updated = await fetchUserHistory(user.uid);
        setHistoryItems(updated);
        return;
      } catch (err) {
        console.warn('Firestore history write warning, saved to local cache:', err);
      }
    }

    setHistoryItems((prev) => [fullItem, ...prev.filter((i) => i.id !== fullItem.id)]);
  };

  const deleteHistory = async (historyId: string) => {
    deleteLocalHistory(historyId);
    if (user) {
      try {
        await deleteHistoryEntry(user.uid, historyId);
      } catch (err) {
        console.warn('Firestore history delete notice:', err);
      }
    }
    setHistoryItems((prev) => prev.filter((i) => i.id !== historyId));
  };

  const saveCustomTariff = async (tariff: TariffConfig) => {
    saveLocalTariff(tariff);
    if (user) {
      try {
        await saveTariffToFirestore(user.uid, tariff);
        const tariffs = await fetchUserTariffs(user.uid);
        setSavedTariffs([DEFAULT_TARIFF, ...(tariffs || [])]);
      } catch (err) {
        console.warn('Firestore tariff write notice:', err);
        setSavedTariffs((prev) => [...prev.filter((t) => t.id !== tariff.id), tariff]);
      }
    } else {
      setSavedTariffs((prev) => [...prev.filter((t) => t.id !== tariff.id), tariff]);
    }
    setActiveTariff(tariff);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        isLoadingAuth,
        login,
        loginAsGuest,
        logout,
        authError,
        clearAuthError,
        historyItems,
        savedTariffs,
        activeTariff,
        setActiveTariff,
        targetBudget,
        setTargetBudget,
        updateTargetBudget,
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
