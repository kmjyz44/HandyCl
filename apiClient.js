import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://handyhub-nbvo.onrender.com";

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('session_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  login: (data) => apiClient.post('/auth/login', data),
  register: (data) => apiClient.post('/auth/register', data),
  getMe: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
  
  // Password Recovery
  requestPasswordRecovery: (email) => apiClient.post('/auth/password-recovery/request', { email }),
  verifyPasswordRecovery: (data) => apiClient.post('/auth/password-recovery/verify', data),

  // Services
  getServices: (category) => apiClient.get('/services', { params: { category } }),
  getService: (id) => apiClient.get(`/services/${id}`),
  createService: (data) => apiClient.post('/services', data),
  updateService: (id, data) => apiClient.put(`/services/${id}`, data),
  deleteService: (id) => apiClient.delete(`/services/${id}`),
  createServiceEnhanced: (data) => apiClient.post('/admin/services/enhanced', data),
  updateServiceEnhanced: (id, data) => apiClient.put(`/admin/services/${id}/enhanced`, data),
  addServiceGalleryItem: (id, item) => apiClient.post(`/admin/services/${id}/gallery`, item),

  // Bookings
  getBookings: () => apiClient.get('/bookings'),
  getBooking: (id) => apiClient.get(`/bookings/${id}`),
  createBooking: (data) => apiClient.post('/bookings', data),
  updateBooking: (id, status, providerId) => 
    apiClient.put(`/bookings/${id}`, null, { params: { status, provider_id: providerId } }),
  updateBookingStatus: (id, status) =>
    apiClient.put(`/bookings/${id}`, null, { params: { status } }),
  assignBooking: (id, data) => apiClient.post(`/admin/bookings/${id}/assign`, data),
  updateBookingAdmin: (id, data) => apiClient.put(`/admin/bookings/${id}`, data),
  reassignBooking: (id, data) => apiClient.post(`/admin/bookings/${id}/reassign`, data),
  
  // Client Bookings
  clientCreateBooking: (data) => apiClient.post('/client/bookings', data),
  clientUpdateBooking: (id, data) => apiClient.put(`/client/bookings/${id}`, data),
  clientSubmitBooking: (id) => apiClient.post(`/client/bookings/${id}/submit`),

  // Tasks
  getTasks: () => apiClient.get('/tasks'),
  getTask: (id) => apiClient.get(`/tasks/${id}`),
  createTask: (data) => apiClient.post('/tasks', data),
  updateTask: (id, data) => apiClient.put(`/tasks/${id}`, data),
  updateTaskStatus: (id, status) => apiClient.put(`/tasks/${id}`, { status }),
  acceptTask: (id) => apiClient.post(`/tasks/${id}/accept`),
  startTask: (id) => apiClient.post(`/tasks/${id}/start`),
  completeTask: (id, data) => apiClient.post(`/tasks/${id}/complete`, data),
  declineTask: (id, reason) => apiClient.post(`/tasks/${id}/decline`, null, { params: { reason } }),
  getProviderTasks: () => apiClient.get('/provider/tasks'),

  // Messages
  getMessages: (withUserId) => apiClient.get('/messages', { params: { with_user_id: withUserId } }),
  sendMessage: (data) => apiClient.post('/messages', data),

  // Reviews
  createReview: (data) => apiClient.post('/reviews', data),
  getProviderReviews: (providerId) => apiClient.get(`/reviews/provider/${providerId}`),

  // Executors / Providers
  getExecutors: () => apiClient.get('/executors'),
  getExecutorsByService: (serviceName, city, lat, lng) => apiClient.get('/executors/by-service', {
    params: {
      ...(serviceName ? { service_name: serviceName } : {}),
      ...(city        ? { city }                       : {}),
      ...(lat != null ? { lat }                        : {}),
      ...(lng != null ? { lng }                        : {}),
    }
  }),
  getAvailableExecutors: (params) => apiClient.get('/executors/available', { params }),
  getExecutorProfile: (userId) => userId ? apiClient.get(`/profile/executor/${userId}`) : apiClient.get('/profile/executor'),
  updateExecutorProfile: (data) => apiClient.put('/profile/executor', data),
  createExecutorProfile: (data) => apiClient.post('/profile/executor', data),
  getProviderStats: (userId) => apiClient.get(`/provider/${userId}/stats`),
  getMyProviderStats: () => apiClient.get('/provider/me/stats'),

  // Availability
  getMyAvailability: () => apiClient.get('/availability'),
  getExecutorAvailability: (userId) => apiClient.get(`/availability/${userId}`),
  createAvailabilitySlot: (data) => apiClient.post('/availability', data),
  updateAvailabilitySlot: (id, data) => apiClient.put(`/availability/${id}`, data),
  deleteAvailabilitySlot: (id) => apiClient.delete(`/availability/${id}`),

  // Pricing
  getExecutorPricing: (executorId) => apiClient.get(`/pricing/${executorId}`),

  // Admin
  getDashboard: () => apiClient.get('/admin/dashboard'),
  getUsers: (role) => apiClient.get('/admin/users', { params: { role } }),
  updateUserRole: (userId, role) => apiClient.put(`/admin/users/${userId}`, null, { params: { role } }),
  blockUser: (userId, reason, durationHours) => 
    apiClient.post(`/admin/users/${userId}/block`, { reason, duration_hours: durationHours }),
  unblockUser: (userId) => apiClient.post(`/admin/users/${userId}/unblock`),
  deleteUser: (userId) => apiClient.delete(`/admin/users/${userId}`),
  getAdminSettings: () => apiClient.get('/admin/settings'),
  updateFeatureSettings: (data) => apiClient.put('/admin/settings/features', data),
  updateSettings: (data) => apiClient.put('/settings', data),
  
  // Admin User Management
  resetUserPassword: (userId, newPassword) => 
    apiClient.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword }),
  viewUserPassword: (userId) => apiClient.get(`/admin/users/${userId}/password`),

  // User Profile
  updateProfile: (data) => apiClient.put('/users/profile', data),
  updateProfilePhoto: (picture) => apiClient.put('/users/profile/photo', { picture }),

  // Payment Methods
  getPaymentMethods: () => apiClient.get('/users/payment-methods'),
  addPaymentMethod: (data) => apiClient.post('/users/payment-methods', data),
  deletePaymentMethod: (id) => apiClient.delete(`/users/payment-methods/${id}`),
  createCheckoutSession: (bookingId) => apiClient.post('/payments/checkout', null, { params: { booking_id: bookingId } }),

  // Saved Addresses
  getSavedAddresses: () => apiClient.get('/users/saved-addresses'),
  addSavedAddress: (data) => apiClient.post('/users/saved-addresses', data),
  deleteSavedAddress: (id) => apiClient.delete(`/users/saved-addresses/${id}`),
  
  // ==================== COMMISSION SYSTEM ====================
  calculateCommission: (basePrice, category, city) => 
    apiClient.get('/commission/calculate', { params: { base_price: basePrice, category, city } }),
  getCommissionRules: () => apiClient.get('/admin/commission-rules'),
  createCommissionRule: (data) => apiClient.post('/admin/commission-rules', data),
  updateCommissionRule: (id, data) => apiClient.put(`/admin/commission-rules/${id}`, data),
  deleteCommissionRule: (id) => apiClient.delete(`/admin/commission-rules/${id}`),
  
  // ==================== TASKER VERIFICATION ====================
  uploadDocument: (data) => apiClient.post('/tasker/documents', data),
  getMyDocuments: () => apiClient.get('/tasker/documents'),
  getPendingDocuments: () => apiClient.get('/admin/documents/pending'),
  verifyDocument: (id, approved, reason) => 
    apiClient.put(`/admin/documents/${id}/verify`, null, { params: { approved, rejection_reason: reason } }),
  
  // ==================== BADGES ====================
  getTaskerBadges: (userId) => apiClient.get(`/tasker/${userId}/badges`),
  awardBadge: (data) => apiClient.post('/admin/badges', data),
  revokeBadge: (id) => apiClient.delete(`/admin/badges/${id}`),
  
  // ==================== PAYOUTS ====================
  createPayoutAccount: (data) => apiClient.post('/tasker/payout-accounts', data),
  getPayoutAccounts: () => apiClient.get('/tasker/payout-accounts'),
  getMyPayouts: () => apiClient.get('/tasker/payouts'),
  getPendingPayouts: () => apiClient.get('/admin/payouts/pending'),
  releasePayout: (data) => apiClient.post('/admin/payouts/release', data),
  sendPayoutToExecutor: (userId, data) => apiClient.post(`/admin/users/${userId}/send-payout`, data),
  getExecutorPayoutMethods: (userId) => apiClient.get(`/admin/users/${userId}/payout-accounts`),
  
  // ==================== REFUNDS ====================
  requestRefund: (data) => apiClient.post('/refunds', data),
  getRefunds: (status) => apiClient.get('/admin/refunds', { params: { status } }),
  approveRefund: (id, approved, reason) => 
    apiClient.put(`/admin/refunds/${id}/approve`, null, { params: { approved, rejection_reason: reason } }),
  
  // ==================== INVOICES ====================
  getInvoice: (id) => apiClient.get(`/invoices/${id}`),
  getClientInvoices: () => apiClient.get('/client/invoices'),
  generateInvoice: (bookingId) => apiClient.post('/admin/invoices/generate', null, { params: { booking_id: bookingId } }),
  
  // ==================== JOB HISTORY ====================
  getJobHistory: (jobId) => apiClient.get(`/admin/job-history/${jobId}`),
  
  // ==================== ESCROW ====================
  createEscrowHold: (bookingId) => apiClient.post(`/escrow/hold?booking_id=${bookingId}`),
  releaseEscrow: (bookingId, reason) => apiClient.post(`/escrow/release?booking_id=${bookingId}&release_reason=${encodeURIComponent(reason)}`),
  refundEscrow: (bookingId, reason, amount) => apiClient.post('/escrow/refund', null, { params: { booking_id: bookingId, refund_reason: reason, refund_amount: amount } }),
  getEscrowStatus: (bookingId) => apiClient.get(`/escrow/status/${bookingId}`),
  
  // ==================== TASKER SEARCH ====================
  searchTaskers: (params) => apiClient.get('/taskers/search', { params }),
  
  // ==================== CMS ====================
  getCMSContent: (type, category, language) => apiClient.get('/cms/content', { params: { content_type: type, category, language } }),
  getCMSContentBySlug: (slug, language) => apiClient.get(`/cms/content/${slug}`, { params: { language } }),
  adminGetCMSContent: (type) => apiClient.get('/admin/cms/content', { params: { content_type: type } }),
  createCMSContent: (data) => apiClient.post('/admin/cms/content', data),
  updateCMSContent: (id, data) => apiClient.put(`/admin/cms/content/${id}`, data),
  deleteCMSContent: (id) => apiClient.delete(`/admin/cms/content/${id}`),
  
  // ==================== FAQ ====================
  getFAQs: (category, language) => apiClient.get('/faq', { params: { category, language } }),
  adminGetFAQs: () => apiClient.get('/admin/faq'),
  createFAQ: (data) => apiClient.post('/admin/faq', data),
  updateFAQ: (id, data) => apiClient.put(`/admin/faq/${id}`, data),
  deleteFAQ: (id) => apiClient.delete(`/admin/faq/${id}`),
  
  // ==================== NOTIFICATIONS ====================
  getNotifications: (unreadOnly = false, limit = 50) => 
    apiClient.get('/notifications', { params: { unread_only: unreadOnly, limit } }),
  getUnreadNotificationCount: () => apiClient.get('/notifications/unread-count'),
  markNotificationRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.put('/notifications/read-all'),
  deleteNotification: (id) => apiClient.delete(`/notifications/${id}`),
  
  // ==================== CONVERSATIONS/CHAT ====================
  getConversations: () => apiClient.get('/conversations'),
  getConversationMessages: (userId, limit = 100) => 
    apiClient.get(`/conversations/${userId}`, { params: { limit } }),
  
  // ==================== INVOICES ====================
  getInvoice: (id) => apiClient.get(`/invoices/${id}`),
  getClientInvoices: () => apiClient.get('/client/invoices'),
  getProviderInvoices: () => apiClient.get('/provider/invoices'),
  createProviderInvoice: (data) => apiClient.post('/provider/invoices/create', data),
  sendInvoice: (id) => apiClient.post(`/provider/invoices/${id}/send`),
  adminGenerateInvoice: (bookingId) => apiClient.post('/admin/invoices/generate', null, { params: { booking_id: bookingId } }),
  
  // ==================== SERVICE ZONES / GEOFENCING ====================
  getActiveServiceZones: () => apiClient.get('/service-zones/active'),
  adminGetServiceZones: () => apiClient.get('/admin/service-zones'),
  adminCreateServiceZone: (data) => apiClient.post('/admin/service-zones', data),
  adminUpdateServiceZone: (id, data) => apiClient.put(`/admin/service-zones/${id}`, data),
  adminDeleteServiceZone: (id) => apiClient.delete(`/admin/service-zones/${id}`),
  adminGetZoneTaskers: (id) => apiClient.get(`/admin/service-zones/${id}/taskers`),
  providerJoinZone: (zoneId) => apiClient.post('/provider/service-zones/join', null, { params: { zone_id: zoneId } }),
  providerLeaveZone: (zoneId) => apiClient.post('/provider/service-zones/leave', null, { params: { zone_id: zoneId } }),
  
  // ==================== PUBLIC SETTINGS ====================
  getPublicSettings: () => apiClient.get('/settings/public'),
  
  // ==================== PROVIDER AVAILABILITY ====================
  getAvailability: () => apiClient.get('/availability'),
  addAvailability: (data) => apiClient.post('/availability', data),
};

export default api;
