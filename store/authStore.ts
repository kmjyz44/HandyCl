import { create } from 'zustand';
import { Platform } from 'react-native';
import axios from 'axios';

const API_BASE = 'https://backend-production-a461.up.railway.app/api';

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
    email_verified?: boolean;
    phone_verified?: boolean;
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
          localStorage.setItem('session_token', token);
    } else {
          await SecureStore.setItemAsync('session_token', token);
    }
};

const getToken = async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
          return localStorage.getItem('session_token');
    }
    return await SecureStore.getItemAsync('session_token');
};

const deleteToken = async () => {
    if (Platform.OS === 'web') {
          localStorage.removeItem('session_token');
    } else {
          await SecureStore.deleteItemAsync('session_token');
    }
};

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    token: null,
    isLoading: true, // Start with loading=true to ensure loadToken completes first

    setUser: (user) => set({ user }),

    setToken: async (token) => {
          if (token) await saveToken(token);
          else await deleteToken();
          set({ token });
    },

    logout: async () => {
          await deleteToken();
          set({ user: null, token: null, isLoading: false });
    },

    loadToken: async () => {
          try {
                const token = await getToken();
                if (!token) {
                      // No saved token — go to login
                      set({ token: null, user: null, isLoading: false });
                      return;
                }
                // Token found — restore user session from server
                set({ token, isLoading: true });
                try {
                      const res = await axios.get(`${API_BASE}/auth/me`, {
                            headers: { Authorization: `Bearer ${token}` },
                            timeout: 10000,
                      });
                      set({ user: res.data, token, isLoading: false });
                } catch (apiErr: any) {
                      if (apiErr?.response?.status === 401) {
                            // Token expired or invalid — clear session
                            await deleteToken();
                            set({ token: null, user: null, isLoading: false });
                      } else {
                            // Server unreachable — keep token but set user from localStorage if available
                            const cachedUser = Platform.OS === 'web'
                                  ? (() => { try { return JSON.parse(localStorage.getItem('cached_user') || 'null'); } catch { return null; } })()
                                  : null;
                            set({ token, user: cachedUser, isLoading: false });
                      }
                }
          } catch (error) {
                console.error('Error loading token:', error);
                set({ token: null, isLoading: false });
          }
    },
}));
