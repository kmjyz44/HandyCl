import axios from 'axios';

const API_URL = 'https://handyhub-nbvo.onrender.com';

let token: string | null = null;
try { token = localStorage.getItem('session_token'); } catch {}

const client = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  let t: string | null = null;
  try { t = localStorage.getItem('session_token'); } catch {}
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

const get = (path: string) => client.get(path).then(r => r.data);
const post = (path: string, data?: any) => client.post(path, data).then(r => r.data);
const put = (path: string, data?: any) => client.put(path, data).then(r => r.data);
const del = (path: string) => client.delete(path).then(r => r.data);

export const api = {
  register: (data: any) => post('/auth/register', data),
  login: (data: any) => post('/auth/login', data),
  getMe: () => get('/auth/me'),
  logout: () => post('/auth/logout'),
  getServices: (category?: string) => get(`/services${category ? `?category=${category}` : ''}`),
  getService: (id: string) => get(`/services/${id}`),
  createService: (data: any) => post('/services', data),
  updateService: (id: string, data: any) => put(`/services/${id}`, data),
  deleteService: (id: string) => del(`/services/${id}`),
  getBookings: () => get('/bookings'),
  getBooking: (id: string) => get(`/bookings/${id}`),
  createBooking: (data: any) => post('/bookings', data),
  updateBooking: (id: string, status: string, providerId?: string) => put(`/bookings/${id}`, { status, provider_id: providerId }),
  getTasks: () => get('/tasks'),
  getTask: (id: string) => get(`/tasks/${id}`),
  createTask: (data: any) => post('/tasks', data),
  updateTask: (id: string, status: string, notes?: string) => put(`/tasks/${id}`, { status, notes }),
  getMessages: (withUserId?: string) => get(`/messages${withUserId ? `?with_user_id=${withUserId}` : ''}`),
  sendMessage: (data: any) => post('/messages', data),
  createReview: (data: any) => post('/reviews', data),
  getProviderReviews: (id: string) => get(`/reviews/provider/${id}`),
  getDashboard: () => get('/admin/dashboard'),
  getUsers: (role?: string) => get(`/admin/users${role ? `?role=${role}` : ''}`),
  updateUserRole: (userId: string, role: string) => put(`/admin/users/${userId}`, { role }),
  blockUser: (userId: string, reason: string, durationHours?: number) => post(`/admin/users/${userId}/block`, { reason, duration_hours: durationHours }),
  unblockUser: (userId: string) => post(`/admin/users/${userId}/unblock`),
  deleteUser: (userId: string) => del(`/admin/users/${userId}`),
  getSettings: () => get('/settings'),
  updateSettings: (data: any) => put('/settings', data),
  updateProfile: (data: any) => put('/users/profile', data),
  getAllExecutors: () => get('/executors'),
  getAvailableExecutors: () => get('/executors/available'),
  getExecutorProfile: (userId: string) => get(`/profile/executor/${userId}`),
  getMyExecutorProfile: () => get('/profile/executor'),
  createExecutorProfile: (data: any) => post('/profile/executor', data),
  updateExecutorProfile: (data: any) => put('/profile/executor', data),
  getMyAvailability: () => get('/availability'),
  createAvailabilitySlot: (data: any) => post('/availability', data),
  getClientTasks: () => get('/client/tasks'),
  getAvailableTasks: (category?: string) => get(`/tasker/available-tasks${category ? `?category=${category}` : ''}`),
  acceptTask: (taskId: string) => post(`/tasker/tasks/${taskId}/accept`),
  startTask: (taskId: string) => post(`/tasker/tasks/${taskId}/start`),
  createOffer: (data: any) => post('/offers', data),
  getBookingOffers: (bookingId: string) => get(`/offers/booking/${bookingId}`),
  getMyOffers: () => get('/offers/my'),
  acceptOffer: (offerId: string) => post(`/offers/${offerId}/accept`),
  declineOffer: (offerId: string) => post(`/offers/${offerId}/decline`),
};
