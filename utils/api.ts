const API_URL = 'https://handyhub-nbvo.onrender.com';

function makeRequest(method: string, url: string, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let token: string | null = null;
    try { token = localStorage.getItem('session_token'); } catch {}
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.timeout = 30000;

    xhr.ontimeout = () => reject(new Error('Timeout. Перевірте інтернет.'));
    xhr.onerror = () => reject(new Error('Не вдалося підключитися до сервера.'));

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve(xhr.responseText); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || 'Request failed'));
        } catch {
          reject(new Error(xhr.responseText || 'Request failed'));
        }
      }
    };

    xhr.send(body || null);
  });
}

const get = (path: string) => makeRequest('GET', `${API_URL}${path}`);
const post = (path: string, data?: any) => makeRequest('POST', `${API_URL}${path}`, data ? JSON.stringify(data) : undefined);
const put = (path: string, data?: any) => makeRequest('PUT', `${API_URL}${path}`, data ? JSON.stringify(data) : undefined);
const del = (path: string) => makeRequest('DELETE', `${API_URL}${path}`);

export const api = {
  register: (data: any) => post('/api/auth/register', data),
  login: (data: any) => post('/api/auth/login', data),
  getMe: () => get('/api/auth/me'),
  logout: () => post('/api/auth/logout'),
  getServices: (category?: string) => get(`/api/services${category ? `?category=${category}` : ''}`),
  getService: (id: string) => get(`/api/services/${id}`),
  createService: (data: any) => post('/api/services', data),
  updateService: (id: string, data: any) => put(`/api/services/${id}`, data),
  deleteService: (id: string) => del(`/api/services/${id}`),
  getBookings: () => get('/api/bookings'),
  getBooking: (id: string) => get(`/api/bookings/${id}`),
  createBooking: (data: any) => post('/api/bookings', data),
  updateBooking: (id: string, status: string, providerId?: string) => put(`/api/bookings/${id}`, { status, provider_id: providerId }),
  getTasks: () => get('/api/tasks'),
  getTask: (id: string) => get(`/api/tasks/${id}`),
  createTask: (data: any) => post('/api/tasks', data),
  updateTask: (id: string, status: string, notes?: string) => put(`/api/tasks/${id}`, { status, notes }),
  getMessages: (withUserId?: string) => get(`/api/messages${withUserId ? `?with_user_id=${withUserId}` : ''}`),
  sendMessage: (data: any) => post('/api/messages', data),
  createReview: (data: any) => post('/api/reviews', data),
  getProviderReviews: (id: string) => get(`/api/reviews/provider/${id}`),
  getDashboard: () => get('/api/admin/dashboard'),
  getUsers: (role?: string) => get(`/api/admin/users${role ? `?role=${role}` : ''}`),
  updateUserRole: (userId: string, role: string) => put(`/api/admin/users/${userId}`, { role }),
  blockUser: (userId: string, reason: string, durationHours?: number) => post(`/api/admin/users/${userId}/block`, { reason, duration_hours: durationHours }),
  unblockUser: (userId: string) => post(`/api/admin/users/${userId}/unblock`),
  deleteUser: (userId: string) => del(`/api/admin/users/${userId}`),
  getSettings: () => get('/api/settings'),
  updateSettings: (data: any) => put('/api/settings', data),
  updateProfile: (data: any) => put('/api/users/profile', data),
  getAllExecutors: () => get('/api/executors'),
  getAvailableExecutors: (params?: any) => get('/api/executors/available'),
  getExecutorProfile: (userId: string) => get(`/api/profile/executor/${userId}`),
  getMyExecutorProfile: () => get('/api/profile/executor'),
  createExecutorProfile: (data: any) => post('/api/profile/executor', data),
  updateExecutorProfile: (data: any) => put('/api/profile/executor', data),
  getMyAvailability: () => get('/api/availability'),
  createAvailabilitySlot: (data: any) => post('/api/availability', data),
  getClientTasks: () => get('/api/client/tasks'),
  getAvailableTasks: (category?: string) => get(`/api/tasker/available-tasks${category ? `?category=${category}` : ''}`),
  acceptTask: (taskId: string) => post(`/api/tasker/tasks/${taskId}/accept`),
  startTask: (taskId: string) => post(`/api/tasker/tasks/${taskId}/start`),
  createOffer: (data: any) => post('/api/offers', data),
  getBookingOffers: (bookingId: string) => get(`/api/offers/booking/${bookingId}`),
  getMyOffers: () => get('/api/offers/my'),
  acceptOffer: (offerId: string) => post(`/api/offers/${offerId}/accept`),
  declineOffer: (offerId: string) => post(`/api/offers/${offerId}/decline`),
};
