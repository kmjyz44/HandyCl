import { useAuthStore } from '../store/authStore';

const API_URL = 'https://handyhub-nbvo.onrender.com';

class API {
  private getHeaders() {
    const token = useAuthStore.getState().token;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.getHeaders(), ...options.headers },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = 'Request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorDetail;
        } catch {
          errorDetail = errorText || errorDetail;
        }
        throw new Error(errorDetail);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') throw new Error('Timeout. Перевірте інтернет.');
      throw error;
    }
  }
register(data: any) { 
  return this.request('/api/auth/register', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data) 
  }); 
}

  login(data: any) { 
  return this.request('/api/auth/login', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data) 
  }); 
  }
  getMe() { return this.request('/api/auth/me'); }
  logout() { return this.request('/api/auth/logout', { method: 'POST' }); }
  getServices(category?: string) { return this.request(`/api/services${category ? `?category=${category}` : ''}`); }
  getService(id: string) { return this.request(`/api/services/${id}`); }
  createService(data: any) { return this.request('/api/services', { method: 'POST', body: JSON.stringify(data) }); }
  updateService(id: string, data: any) { return this.request(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  deleteService(id: string) { return this.request(`/api/services/${id}`, { method: 'DELETE' }); }
  getBookings() { return this.request('/api/bookings'); }
  getBooking(id: string) { return this.request(`/api/bookings/${id}`); }
  createBooking(data: any) { return this.request('/api/bookings', { method: 'POST', body: JSON.stringify(data) }); }
  updateBooking(id: string, status: string, providerId?: string) { return this.request(`/api/bookings/${id}`, { method: 'PUT', body: JSON.stringify({ status, provider_id: providerId }) }); }
  getTasks() { return this.request('/api/tasks'); }
  getTask(id: string) { return this.request(`/api/tasks/${id}`); }
  createTask(data: any) { return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(data) }); }
  updateTask(id: string, status: string, notes?: string) { return this.request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status, notes }) }); }
  getMessages(withUserId?: string) { return this.request(`/api/messages${withUserId ? `?with_user_id=${withUserId}` : ''}`); }
  sendMessage(data: any) { return this.request('/api/messages', { method: 'POST', body: JSON.stringify(data) }); }
  createReview(data: any) { return this.request('/api/reviews', { method: 'POST', body: JSON.stringify(data) }); }
  getProviderReviews(id: string) { return this.request(`/api/reviews/provider/${id}`); }
  getDashboard() { return this.request('/api/admin/dashboard'); }
  getUsers(role?: string) { return this.request(`/api/admin/users${role ? `?role=${role}` : ''}`); }
  updateUserRole(userId: string, role: string) { return this.request(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }); }
  blockUser(userId: string, reason: string, durationHours?: number) { return this.request(`/api/admin/users/${userId}/block`, { method: 'POST', body: JSON.stringify({ reason, duration_hours: durationHours }) }); }
  unblockUser(userId: string) { return this.request(`/api/admin/users/${userId}/unblock`, { method: 'POST' }); }
  deleteUser(userId: string) { return this.request(`/api/admin/users/${userId}`, { method: 'DELETE' }); }
  getSettings() { return this.request('/api/settings'); }
  updateSettings(data: any) { return this.request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }); }
  updateProfile(data: any) { return this.request('/api/users/profile', { method: 'PUT', body: JSON.stringify(data) }); }
  getAllExecutors() { return this.request('/api/executors'); }
  getAvailableExecutors(params?: any) { return this.request('/api/executors/available'); }
  getExecutorProfile(userId: string) { return this.request(`/api/profile/executor/${userId}`); }
  getMyExecutorProfile() { return this.request('/api/profile/executor'); }
  createExecutorProfile(data: any) { return this.request('/api/profile/executor', { method: 'POST', body: JSON.stringify(data) }); }
  updateExecutorProfile(data: any) { return this.request('/api/profile/executor', { method: 'PUT', body: JSON.stringify(data) }); }
  getMyAvailability() { return this.request('/api/availability'); }
  createAvailabilitySlot(data: any) { return this.request('/api/availability', { method: 'POST', body: JSON.stringify(data) }); }
  getClientTasks() { return this.request('/api/client/tasks'); }
  getAvailableTasks(category?: string) { return this.request(`/api/tasker/available-tasks${category ? `?category=${category}` : ''}`); }
  acceptTask(taskId: string) { return this.request(`/api/tasker/tasks/${taskId}/accept`, { method: 'POST' }); }
  startTask(taskId: string) { return this.request(`/api/tasker/tasks/${taskId}/start`, { method: 'POST' }); }
  createOffer(data: any) { return this.request('/api/offers', { method: 'POST', body: JSON.stringify(data) }); }
  getBookingOffers(bookingId: string) { return this.request(`/api/offers/booking/${bookingId}`); }
  getMyOffers() { return this.request('/api/offers/my'); }
  acceptOffer(offerId: string) { return this.request(`/api/offers/${offerId}/accept`, { method: 'POST' }); }
  declineOffer(offerId: string) { return this.request(`/api/offers/${offerId}/decline`, { method: 'POST' }); }
}

export const api = new API();
