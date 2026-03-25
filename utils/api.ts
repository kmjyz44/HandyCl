import axios from 'axios';
import { Platform } from 'react-native';

const API_URL =
  (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '') ||
  'https://handyhub-nbvo.onrender.com';

const client = axios.create({
  baseURL: `${API_URL}/api`,
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

  logout: async () => {
    const res = await client.post('/auth/logout');
    return res.data;
  },

  // User Profile
  updateProfile: async (data: any) => {
    const res = await client.put('/users/profile', data);
    return res.data;
  },

  updateProfilePhoto: async (picture: string) => {
    const res = await client.put('/users/profile/photo', { picture });
    return res.data;
  },

  // Payment Methods
  getPaymentMethods: async () => {
    const res = await client.get('/users/payment-methods');
    return res.data;
  },

  addPaymentMethod: async (data: any) => {
    const res = await client.post('/users/payment-methods', data);
    return res.data;
  },

  deletePaymentMethod: async (id: string) => {
    const res = await client.delete(`/users/payment-methods/${id}`);
    return res.data;
  },

  // Saved Addresses
  getSavedAddresses: async () => {
    const res = await client.get('/users/saved-addresses');
    return res.data;
  },

  addSavedAddress: async (data: any) => {
    const res = await client.post('/users/saved-addresses', data);
    return res.data;
  },

  deleteSavedAddress: async (id: string) => {
    const res = await client.delete(`/users/saved-addresses/${id}`);
    return res.data;
  },

  // Executor Profile
  getMyExecutorProfile: async () => {
    const res = await client.get('/profile/executor');
    return res.data;
  },

  updateExecutorProfile: async (data: any) => {
    const res = await client.put('/profile/executor', data);
    return res.data;
  },

  createExecutorProfile: async (data: any) => {
    const res = await client.post('/profile/executor', data);
    return res.data;
  },

  // Reviews
  getProviderReviews: async (providerId: string) => {
    const res = await client.get(`/reviews/provider/${providerId}`);
    return res.data;
  },

  // Bookings
  getBookings: async () => {
    const res = await client.get('/bookings');
    return res.data;
  },

  // Services
  getServices: async (category?: string) => {
    const res = await client.get('/services', { params: category ? { category } : {} });
    return res.data;
  },

  // Executors
  getExecutors: async () => {
    const res = await client.get('/executors');
    return res.data;
  },

  getExecutorsByService: async (params: any) => {
    const res = await client.get('/executors/by-service', { params });
    return res.data;
  },

  getExecutorsBySkill: async (params: { skill?: string; category?: string; city?: string }) => {
    // Try skill-based search first, fall back to general executors
    try {
      const res = await client.get('/executors/by-skill', { params });
      return res.data;
    } catch {
      const res = await client.get('/executors', { params: { city: params.city } });
      return res.data;
    }
  },

  getExecutorById: async (id: string) => {
    const res = await client.get(`/executors/${id}`);
    return res.data;
  },

  // Bookings (client)
  createBooking: async (data: any) => {
    const res = await client.post('/bookings', data);
    return res.data;
  },

  getClientBookings: async () => {
    const res = await client.get('/bookings');
    return res.data;
  },

  cancelBooking: async (id: string) => {
    const res = await client.post(`/bookings/${id}/cancel`);
    return res.data;
  },

  // Tasks (provider)
  getAvailableTasks: async () => {
    try {
      const res = await client.get('/tasks/available');
      return res.data;
    } catch {
      return [];
    }
  },

  getTasks: async () => {
    try {
      const res = await client.get('/provider/tasks');
      return res.data;
    } catch {
      return [];
    }
  },

  getTask: async (id: string) => {
    const res = await client.get(`/tasks/${id}`);
    return res.data;
  },

  onTheWayTask: async (id: string) => {
    const res = await client.post(`/tasks/${id}/on-the-way`);
    return res.data;
  },

  // Notifications
  getNotifications: async (unreadOnly = false, limit = 50) => {
    const res = await client.get('/notifications', { params: { unread_only: unreadOnly, limit } });
    return res.data;
  },

  getUnreadNotificationCount: async () => {
    const res = await client.get('/notifications/unread-count');
    return res.data;
  },

  markNotificationRead: async (id: string) => {
    const res = await client.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllNotificationsRead: async () => {
    const res = await client.put('/notifications/read-all');
    return res.data;
  },

  // Tasks
  getProviderTasks: async () => {
    const res = await client.get('/provider/tasks');
    return res.data;
  },

  acceptTask: async (id: string) => {
    const res = await client.post(`/tasks/${id}/accept`);
    return res.data;
  },

  declineTask: async (id: string, reason: string) => {
    const res = await client.post(`/tasks/${id}/decline`, null, { params: { reason } });
    return res.data;
  },

  startTask: async (id: string) => {
    const res = await client.post(`/tasks/${id}/start`);
    return res.data;
  },

  completeTask: async (id: string, data: any) => {
    const res = await client.post(`/tasks/${id}/complete`, data);
    return res.data;
  },

  // Messages
  getConversations: async () => {
    const res = await client.get('/conversations');
    return res.data;
  },

  getConversationMessages: async (userId: string, limit = 100) => {
    const res = await client.get(`/conversations/${userId}`, { params: { limit } });
    return res.data;
  },

  sendMessage: async (data: any) => {
    const res = await client.post('/messages', data);
    return res.data;
  },

  // Availability
  getMyAvailability: async () => {
    const res = await client.get('/availability');
    return res.data;
  },

  createAvailabilitySlot: async (data: any) => {
    const res = await client.post('/availability', data);
    return res.data;
  },

  deleteAvailabilitySlot: async (id: string) => {
    const res = await client.delete(`/availability/${id}`);
    return res.data;
  },

  // Earnings
  getMyPayouts: async () => {
    const res = await client.get('/tasker/payouts');
    return res.data;
  },

  getPayoutAccounts: async () => {
    const res = await client.get('/tasker/payout-accounts');
    return res.data;
  },

  createPayoutAccount: async (data: any) => {
    const res = await client.post('/tasker/payout-accounts', data);
    return res.data;
  },

  // Admin
  getAdminDashboard: async () => {
    const res = await client.get('/admin/dashboard');
    return res.data;
  },

  getUsers: async (role?: string) => {
    const res = await client.get('/admin/users', { params: role ? { role } : {} });
    return res.data;
  },

  blockUser: async (userId: string, reason: string, durationHours: number) => {
    const res = await client.post(`/admin/users/${userId}/block`, { reason, duration_hours: durationHours });
    return res.data;
  },

  unblockUser: async (userId: string) => {
    const res = await client.post(`/admin/users/${userId}/unblock`);
    return res.data;
  },

  deleteUser: async (userId: string) => {
    const res = await client.delete(`/admin/users/${userId}`);
    return res.data;
  },

  // Client invoices
  getClientInvoices: async () => {
    const res = await client.get('/client/invoices');
    return res.data;
  },
};
