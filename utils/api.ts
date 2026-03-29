import axios from 'axios';
import { Platform } from 'react-native';

const API_URL =
  (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '') ||
  'https://backend-production-a461.up.railway.app';

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

  createReview: async (data: { booking_id: string; rating: number; comment?: string; tip_amount?: number }) => {
    const res = await client.post('/reviews', data);
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
    // Backend returns { executors: [...], total: N } or plain array
    if (Array.isArray(res.data)) return res.data;
    if (res.data?.executors) return res.data.executors;
    return [];
  },

  getExecutorsByService: async (params: any) => {
    const res = await client.get('/executors/by-service', { params });
    return res.data;
  },

  getExecutorsBySkill: async (params: { skill?: string; category?: string; city?: string; lat?: number; lng?: number; date?: string; timeFrom?: string }) => {
    try {
      // Use the full by-service endpoint which supports skill + location + availability filtering
      const queryParams: Record<string, any> = {};
      if (params.skill) queryParams.service_name = params.skill;
      if (params.city) queryParams.city = params.city;
      if (params.lat != null) queryParams.lat = params.lat;
      if (params.lng != null) queryParams.lng = params.lng;
      const res = await client.get('/executors/by-service', { params: queryParams });
      let list = Array.isArray(res.data) ? res.data : (res.data?.executors || []);
      // Client-side availability filter: if date + time selected, only show executors available that day/time
      if (params.date && params.timeFrom) {
        const dayOfWeek = new Date(params.date).getDay(); // 0=Sun, 1=Mon, ...
        list = list.filter((ex: any) => {
          const slots = ex.availability_slots || [];
          if (!slots.length) return true; // no slots set — include
          return slots.some((slot: any) =>
            slot.is_active !== false &&
            slot.day_of_week === dayOfWeek &&
            slot.start_time <= params.timeFrom! &&
            slot.end_time > params.timeFrom!
          );
        });
      }
      return list;
    } catch {
      // Fallback: load all executors without filtering
      try {
        const res = await client.get('/executors');
        return Array.isArray(res.data) ? res.data : (res.data?.executors || []);
      } catch {
        return [];
      }
    }
  },

  getExecutorById: async (id: string) => {
    const res = await client.get(`/executors/${id}`);
    return res.data;
  },

  // Executor profile (used by /executor/[id].tsx)
  getExecutorProfile: async (id: string) => {
    try {
      const res = await client.get(`/executors/${id}/profile`);
      return res.data;
    } catch {
      // Fallback to /executors/:id
      const res = await client.get(`/executors/${id}`);
      return res.data;
    }
  },

  getExecutorAvailability: async (id: string) => {
    try {
      const res = await client.get(`/executors/${id}/availability`);
      if (Array.isArray(res.data)) return res.data;
      return res.data?.availability || res.data?.slots || [];
    } catch {
      return [];
    }
  },

  getExecutorPricing: async (id: string) => {
    try {
      const res = await client.get(`/executors/${id}/pricing`);
      return res.data;
    } catch {
      return null;
    }
  },

  // Alias used by executors.tsx
  getAvailableExecutors: async (params?: any) => {
    try {
      const res = await client.get('/executors/available', { params });
      return res.data; // { executors: [...] }
    } catch {
      // Fallback to /executors
      const res = await client.get('/executors', { params });
      if (Array.isArray(res.data)) return { executors: res.data };
      return res.data;
    }
  },

  getAllExecutors: async () => {
    const res = await client.get('/executors');
    if (Array.isArray(res.data)) return res.data;
    if (res.data?.executors) return res.data.executors;
    return [];
  },

  // Single booking
  getBooking: async (id: string) => {
    const res = await client.get(`/bookings/${id}`);
    return res.data;
  },

  // Single service
  getService: async (id: string) => {
    try {
      const res = await client.get(`/services/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  // Favorites
  getFavoriteExecutors: async () => {
    try {
      const res = await client.get('/client/favorites');
      return res.data?.favorites || res.data || [];
    } catch {
      // Fallback: store favorites in localStorage on web
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('favorite_executors');
        return stored ? JSON.parse(stored) : [];
      }
      return [];
    }
  },

  addFavoriteExecutor: async (executor: any) => {
    try {
      const res = await client.post('/client/favorites', { executor_id: executor.user_id || executor.id });
      return res.data;
    } catch {
      // Fallback: store in localStorage
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('favorite_executors');
        const favs = stored ? JSON.parse(stored) : [];
        const id = executor.user_id || executor.id;
        if (!favs.find((f: any) => (f.user_id || f.id) === id)) {
          favs.push(executor);
          localStorage.setItem('favorite_executors', JSON.stringify(favs));
        }
      }
      return { ok: true };
    }
  },

  removeFavoriteExecutor: async (executorId: string) => {
    try {
      const res = await client.delete(`/client/favorites/${executorId}`);
      return res.data;
    } catch {
      // Fallback: remove from localStorage
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('favorite_executors');
        const favs = stored ? JSON.parse(stored) : [];
        const updated = favs.filter((f: any) => (f.user_id || f.id) !== executorId);
        localStorage.setItem('favorite_executors', JSON.stringify(updated));
      }
      return { ok: true };
    }
  },

  // Bookings (client)
  createBooking: async (data: any) => {
    // Map our category IDs to backend ServiceCategory enum values
    const categoryMap: Record<string, string> = {
      assembly: 'handyman_assembly',
      cleaning: 'cleaning_regular',
      repair: 'handyman_carpentry',
      moving: 'moving_local',
      outdoor: 'gardening',
      personal: 'other',
      it_tech: 'other',
      events: 'other',
      other: 'other',
    };
    const payload = {
      ...data,
      category: categoryMap[data.category] || data.category || undefined,
    };
    try {
      const res = await client.post('/bookings', payload);
      return res.data;
    } catch (err: any) {
      // If backend returns non-JSON 500, throw a readable error
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Помилка сервера';
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
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
      // Correct endpoint: /api/tasker/available-tasks
      const res = await client.get('/tasker/available-tasks');
      return Array.isArray(res.data) ? res.data : (res.data?.tasks ?? []);
    } catch {
      return [];
    }
  },

  getTasks: async () => {
    try {
      // /api/provider/tasks returns { tasks: [...], commission_percent: N }
      const res = await client.get('/provider/tasks');
      return Array.isArray(res.data) ? res.data : (res.data?.tasks ?? []);
    } catch {
      return [];
    }
  },

  getTask: async (id: string) => {
    const res = await client.get(`/tasks/${id}`);
    return res.data;
  },

  onTheWayTask: async (id: string) => {
    // Use generic endpoint which resolves by booking_id too
    try {
      const res = await client.post(`/tasks/${id}/on-the-way`);
      return res.data;
    } catch {
      const res = await client.post(`/tasker/tasks/${id}/on-the-way`);
      return res.data;
    }
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
  payTask: async (id: string, data: { payment_method: string }) => {
    const res = await client.post(`/tasks/${id}/pay`, data);
    return res.data;
  },
  getTaskMessages: async (taskId: string) => {
    const res = await client.get(`/tasks/${taskId}/messages`);
    return res.data;
  },
  sendTaskMessage: async (taskId: string, text: string, imageUrl?: string) => {
    const res = await client.post(`/tasks/${taskId}/messages`, { text, image_url: imageUrl || undefined });
    return res.data;
  },
  // Moderator management
  getModerators: async () => {
    const res = await client.get('/admin/moderators');
    return res.data;
  },
  setModerator: async (userId: string) => {
    const res = await client.post(`/admin/users/${userId}/set-moderator`);
    return res.data;
  },
  removeModerator: async (userId: string) => {
    const res = await client.post(`/admin/users/${userId}/remove-moderator`);
    return res.data;
  },
  updateModeratorModules: async (userId: string, modules: string[]) => {
    const res = await client.put(`/admin/users/${userId}/moderator-modules`, modules);
    return res.data;
  },
  getAvailableModules: async () => {
    const res = await client.get('/admin/available-modules');
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

  // Account management
  deleteAccount: async () => {
    const res = await client.delete('/users/me');
    return res.data;
  },

  sendSupportMessage: async (data: { email: string; message: string }) => {
    const res = await client.post('/support/message', data).catch(() => ({ data: { ok: true } }));
    return res.data;
  },
};
