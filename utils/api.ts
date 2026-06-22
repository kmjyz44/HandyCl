import axios from 'axios';
import { Platform } from 'react-native';

const API_URL =
  (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '') ||
  'https://backend-production-a461.up.railway.app';

const client = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000, // 60s — base64 image uploads can take longer on slow mobile networks
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

  getCategories: async () => {
    const res = await client.get('/categories');
    return res.data;
  },

  getCategoryOne: async (id: string) => {
    const res = await client.get(`/categories/${id}`);
    return res.data;
  },

  adminGetCategories: async () => {
    const res = await client.get('/admin/categories');
    return res.data;
  },

  adminGetCategoryOne: async (id: string) => {
    const res = await client.get(`/admin/categories/${id}`);
    return res.data;
  },

  adminGetIntegrationKeys: async () => {
    const res = await client.get('/admin/integration-keys');
    return res.data;
  },

  adminUpdateIntegrationKeys: async (data: Record<string, any>) => {
    const res = await client.put('/admin/integration-keys', data);
    return res.data;
  },

  createCategory: async (data: { name: string; description?: string; icon?: string; image?: string; parent_id?: string; commission_rate?: number; recommended_price?: number }) => {
    const res = await client.post('/admin/categories', data);
    return res.data;
  },

  updateCategory: async (id: string, data: { name?: string; description?: string; icon?: string; image?: string; commission_rate?: number; recommended_price?: number; is_active?: boolean }) => {
    const res = await client.put(`/admin/categories/${id}`, data);
    return res.data;
  },

  deleteCategory: async (id: string, hard: boolean = false) => {
    const res = await client.delete(`/admin/categories/${id}`, { params: { hard } });
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
      if (params.category) queryParams.category = params.category;
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
      // On error return empty list (do NOT fallback to all executors — would ignore city filter)
      return [];
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

  // Web Push (browser only)
  getVapidPublicKey: async () => {
    const res = await client.get('/push/vapid-public-key');
    return res.data;
  },
  subscribeWebPush: async (data: any) => {
    const res = await client.post('/push/subscribe', data);
    return res.data;
  },
  unsubscribeWebPush: async (data: any) => {
    const res = await client.delete('/push/subscribe', { data });
    return res.data;
  },
  testPush: async () => {
    const res = await client.post('/push/test');
    return res.data;
  },

  // Blog / Community feed
  listBlogPosts: async (params?: { limit?: number; offset?: number; category?: string; author_id?: string }) => {
    const res = await client.get('/blog/posts', { params });
    return res.data;
  },
  createBlogPost: async (data: { title: string; description: string; images?: string[]; tags?: string[]; category?: string; booking_id?: string }) => {
    const res = await client.post('/blog/posts', data);
    return res.data;
  },
  getBlogPost: async (id: string) => {
    const res = await client.get(`/blog/posts/${id}`);
    return res.data;
  },
  toggleBlogLike: async (id: string) => {
    const res = await client.post(`/blog/posts/${id}/like`);
    return res.data;
  },
  addBlogComment: async (id: string, text: string) => {
    const res = await client.post(`/blog/posts/${id}/comments`, { text });
    return res.data;
  },
  deleteBlogPost: async (id: string) => {
    const res = await client.delete(`/blog/posts/${id}`);
    return res.data;
  },

  // Multi-method payments
  getPaymentMethods: async () => {
    const res = await client.get('/payments/methods');
    return res.data;
  },
  getManualInstructions: async (bookingId: string, method: string) => {
    const res = await client.get('/payments/manual-instructions', { params: { booking_id: bookingId, method } });
    return res.data;
  },
  confirmManualPayment: async (data: { booking_id: string; method: string; note?: string; tip_amount?: number }) => {
    const res = await client.post('/payments/manual-confirm', data);
    return res.data;
  },
  executorConfirmPayment: async (data: { booking_id: string; action: 'confirm' | 'reject' }) => {
    const res = await client.post('/payments/executor-confirm', data);
    return res.data;
  },
  verifyManualPayment: async (transactionId: string, action: 'approve' | 'reject') => {
    const res = await client.post(`/admin/payments/${transactionId}/verify`, { action });
    return res.data;
  },
  listPendingManualPayments: async () => {
    const res = await client.get('/admin/payments/pending');
    return res.data;
  },
  // Provider payout contacts (PayPal/Zelle/Venmo handles)
  getTaskerPayoutContacts: async () => {
    const res = await client.get('/tasker/payout-contacts');
    return res.data;
  },
  updateTaskerPayoutContacts: async (data: { paypal_email?: string; zelle_handle?: string; venmo_handle?: string }) => {
    const res = await client.put('/tasker/payout-contacts', data);
    return res.data;
  },

  // Help Center / Support
  getFaq: async () => {
    const res = await client.get('/help/faq');
    return res.data;
  },
  getSupportInfo: async () => {
    const res = await client.get('/help/support-info');
    return res.data;
  },
  getAdminContact: async () => {
    const res = await client.get('/help/admin-contact');
    return res.data;
  },
  // Direct user-to-user messages (used for support chat with admin)
  getDirectMessages: async (withUserId: string) => {
    const res = await client.get('/messages', { params: { with_user_id: withUserId } });
    return res.data;
  },
  sendDirectMessage: async (toUserId: string, message: string) => {
    const res = await client.post('/messages', { to_user_id: toUserId, message });
    return res.data;
  },
  submitSupportRequest: async (data: { name: string; email: string; subject?: string; message: string; category?: string }) => {
    const res = await client.post('/help/support-request', data);
    return res.data;
  },
  listSupportRequests: async (params?: { status?: string; limit?: number; offset?: number }) => {
    const res = await client.get('/admin/support-requests', { params });
    return res.data;
  },
  updateSupportRequest: async (id: string, payload: { status?: string; notes?: string }) => {
    const res = await client.put(`/admin/support-requests/${id}`, payload);
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
  startStripeCheckout: async (bookingId: string) => {
    // Returns { url, session_id } — caller redirects browser to `url`
    const res = await client.post('/payments/checkout', { booking_id: bookingId });
    return res.data;
  },
  getPaymentStatus: async (sessionId: string) => {
    const res = await client.get(`/payments/status/${sessionId}`);
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

  updateAvailabilitySlot: async (id: string, data: any) => {
    const res = await client.put(`/availability/${id}`, data);
    return res.data;
  },

  deleteAvailabilitySlot: async (id: string) => {
    const res = await client.delete(`/availability/${id}`);
    return res.data;
  },

  // Earnings
  getEarnings: async () => {
    const res = await client.get('/earnings');
    return res.data;
  },

  getEarningsHistory: async (limit: number = 365) => {
    const res = await client.get('/earnings/history', { params: { limit } });
    return res.data;
  },

  // Returns a Blob (PDF). type: 'monthly' | 'yearly' | 'tax'; month: 'YYYY-MM' (for monthly); year: 'YYYY' (for yearly/tax)
  downloadEarningsReport: async (params: { type: 'monthly' | 'yearly' | 'tax'; month?: string; year?: string }) => {
    const res = await client.get('/earnings/report', { params, responseType: 'blob' });
    return res.data as Blob;
  },

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

  deletePayoutAccount: async (id: string) => {
    const res = await client.delete(`/tasker/payout-accounts/${id}`);
    return res.data;
  },

  setDefaultPayoutAccount: async (id: string) => {
    const res = await client.post(`/tasker/payout-accounts/${id}/default`);
    return res.data;
  },

  // Stripe Connect (executor onboarding for auto-payouts)
  stripeConnectOnboard: async () => {
    const res = await client.post('/tasker/stripe-connect/onboard');
    return res.data;  // { url, account_id }
  },
  stripeConnectStatus: async () => {
    const res = await client.get('/tasker/stripe-connect/status');
    return res.data;
  },
  stripeConnectDashboardLink: async () => {
    const res = await client.post('/tasker/stripe-connect/dashboard-link');
    return res.data;
  },

  // Admin
  getAdminDashboard: async () => {
    const res = await client.get('/admin/dashboard');
    return res.data;
  },

  getSettings: async () => {
    const res = await client.get('/admin/settings');
    return res.data;
  },

  updateSettings: async (data: any) => {
    const res = await client.put('/admin/settings', data);
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

  // Create client task (booking) - used by create-task.tsx
  createClientTask: async (data: {
    category: string;
    title: string;
    description: string;
    address: string;
    scheduled_date?: string;
    scheduled_time?: string;
    estimated_hours?: number;
    photos?: string[];
    allow_offers?: boolean;
  }) => {
    // Limit photos to avoid payload too large (max 3 photos, each stripped of data: prefix)
    const safePhotos = data.photos
      ? data.photos.slice(0, 3).map(p => {
          // Strip data:image/...;base64, prefix if present
          const b64 = p.includes(',') ? p.split(',')[1] : p;
          // Truncate if > 500KB base64 (~375KB binary)
          return b64.length > 700000 ? b64.slice(0, 700000) : b64;
        })
      : undefined;
    const payload = {
      title: data.title,
      description: data.description,
      category: data.category,
      address: data.address,
      date: data.scheduled_date || undefined,
      time: data.scheduled_time || undefined,
      estimated_hours: data.estimated_hours,
      problem_photos: safePhotos,
      allow_offers: data.allow_offers ?? true,
    };
    try {
      const res = await client.post('/bookings', payload);
      return res.data;
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || 'Помилка сервера';
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
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
  // Admin task management
  adminGetTasks: async (params?: { status?: string; provider_id?: string; client_id?: string; category?: string; limit?: number; skip?: number }) => {
    const res = await client.get('/admin/tasks', { params });
    return res.data;
  },
  adminDeleteTask: async (taskId: string) => {
    const res = await client.delete(`/admin/tasks/${taskId}`);
    return res.data;
  },
  adminChangeTaskStatus: async (taskId: string, status: string, actualHours?: number, finalPrice?: number) => {
    const res = await client.patch(`/admin/tasks/${taskId}/status`, null, {
      params: { status, ...(actualHours != null ? { actual_hours: actualHours } : {}), ...(finalPrice != null ? { final_price: finalPrice } : {}) }
    });
    return res.data;
  },
  adminUpdateTask: async (taskId: string, data: { actual_hours?: number; final_price?: number; notes?: string; provider_id?: string }) => {
    const res = await client.put(`/admin/tasks/${taskId}`, null, { params: data });
    return res.data;
  },

  // Provider stats
  getMyProviderStats: async () => {
    const res = await client.get('/provider/me/stats');
    return res.data;
  },

  // Unread messages count (for tab badge)
  getUnreadMessagesCount: async (): Promise<number> => {
    try {
      const res = await client.get('/messages/unread-count');
      return res.data?.unread_count ?? 0;
    } catch {
      return 0;
    }
  },

  // Mark all messages in a task as read
  markTaskMessagesRead: async (taskId: string): Promise<void> => {
    try {
      await client.post(`/tasks/${taskId}/messages/read`);
    } catch {}
  },
};
