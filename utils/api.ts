import axios from 'axios';
import { Platform } from 'react-native';

const API_URL =
  (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '') ||
  'https://handyhub-nbvo.onrender.com';

const client = axios.create({
  baseURL:
    Platform.OS === 'web' ? '/api' : `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    token = localStorage.getItem('session_token');
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const api = {
  getMe: async () => {
    const res = await client.get('/auth/me');
    return res.data;
  },

  login: async (data: any) => {
    const res = await client.post('/auth/login', data);
    return res.data;
  },

  register: async (data: any) => {
    const res = await client.post('/auth/register', data);
    return res.data;
  },
};
