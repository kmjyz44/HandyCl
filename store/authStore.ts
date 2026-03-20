import { create } from 'zustand';
import { Platform } from 'react-native';

let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

interface User {
  user_id: string;
  email: string;
  name: string;
  role: 'client' | 'provider' | 'admin';
  phone?: string;
  picture?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
}

const saveToken = async (token: string) => {
  if (Platform.OS === 'web') {
    try { localStorage.setItem('session_token', token); } catch {}
  } else {
    await SecureStore.setItemAsync('session_token', token);
  }
};

const getToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem('session_token'); } catch { return null; }
  }
  return await SecureStore.getItemAsync('session_token');
};

const deleteToken = async () => {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem('session_token'); } catch {}
  } else {
    await SecureStore.deleteItemAsync('session_token');
  }
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  setToken: async (token) => {
    if (token) {
      await saveToken(token);
    } else {
      await deleteToken();
    }
    set({ token });
  },

  logout: async () => {
    await deleteToken();
    set({ user: null, token: null });
  },

  loadToken: async () => {
    try {
      const token = await getToken();
      set({ token, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
