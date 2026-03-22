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
  setUser: (user: User | null) => Promise<void>;
  setToken: (token: string | null) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
}

const TOKEN_KEY = 'session_token';
const USER_KEY = 'session_user';

const saveItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {}
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const getItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  return await SecureStore.getItemAsync(key);
};

const deleteItem = async (key: string) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {}
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setUser: async (user) => {
    if (user) {
      await saveItem(USER_KEY, JSON.stringify(user));
    } else {
      await deleteItem(USER_KEY);
    }

    set({ user });
  },

  setToken: async (token) => {
    if (token) {
      await saveItem(TOKEN_KEY, token);
    } else {
      await deleteItem(TOKEN_KEY);
    }

    set({ token });
  },

  logout: async () => {
    await deleteItem(TOKEN_KEY);
    await deleteItem(USER_KEY);
    set({ user: null, token: null, isLoading: false });
  },

  loadToken: async () => {
    try {
      const [token, rawUser] = await Promise.all([
        getItem(TOKEN_KEY),
        getItem(USER_KEY),
      ]);

      let user: User | null = null;

      if (rawUser) {
        try {
          user = JSON.parse(rawUser);
        } catch {
          user = null;
        }
      }

      set({ token, user, isLoading: false });
    } catch {
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
