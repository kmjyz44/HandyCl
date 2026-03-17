import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

// Backend URL - configured in app.json extra.backendUrl
const API_URL = Constants.expoConfig?.extra?.backendUrl || 
                process.env.EXPO_PUBLIC_BACKEND_URL || 
                'https://handyhub-preview-1.preview.emergentagent.com';

console.log('API_URL configured:', API_URL);

console.log('API_URL configured:', API_URL);

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
    console.log('=== API Request ===');
    console.log('URL:', url);
    console.log('Method:', options.method || 'GET');
    console.log('Headers:', this.getHeaders());
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      console.log('Sending request...');
      const response = await fetch(url, config);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Network error' }));
        console.error('Response error:', error);
        throw new Error(error.detail || 'Request failed');
      }

      const data = await response.json();
      console.log('Response success:', data);
      return data;
    } catch (error: any) {
      console.error('=== API Error ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      throw error;
    }
  }

  // Auth
  register(data: any) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  login(data: any) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getMe() {
    return this.request('/api/auth/me');
  }

  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  createSessionFromOAuth(sessionId: string) {
    return this.request('/api/auth/session', {
      method: 'POST',
      headers: { 'X-Session-ID': sessionId },
    });
  }

  // Services
  getServices(category?: string) {
    const params = category ? `?category=${category}` : '';
    return this.request(`/api/services${params}`);
  }

  getService(serviceId: string) {
    return this.request(`/api/services/${serviceId}`);
  }

  createService(data: any) {
    return this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateService(serviceId: string, data: any) {
    return this.request(`/api/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteService(serviceId: string) {
    return this.request(`/api/services/${serviceId}`, { method: 'DELETE' });
  }

  // Bookings
  getBookings() {
    return this.request('/api/bookings');
  }

  getBooking(bookingId: string) {
    return this.request(`/api/bookings/${bookingId}`);
  }

  createBooking(data: any) {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateBooking(bookingId: string, status: string, providerId?: string) {
    return this.request(`/api/bookings/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, provider_id: providerId }),
    });
  }

  // Tasks
  getTasks() {
    return this.request('/api/tasks');
  }

  getTask(taskId: string) {
    return this.request(`/api/tasks/${taskId}`);
  }

  createTask(data: any) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateTask(taskId: string, status: string, notes?: string) {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  // Messages
  getMessages(withUserId?: string) {
    const params = withUserId ? `?with_user_id=${withUserId}` : '';
    return this.request(`/api/messages${params}`);
  }

  sendMessage(data: any) {
    return this.request('/api/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reviews
  createReview(data: any) {
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getProviderReviews(providerId: string) {
    return this.request(`/api/reviews/provider/${providerId}`);
  }

  // Admin
  getDashboard() {
    return this.request('/api/admin/dashboard');
  }

  getUsers(role?: string) {
    const params = role ? `?role=${role}` : '';
    return this.request(`/api/admin/users${params}`);
  }

  updateUserRole(userId: string, role: string) {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  // User Management
  blockUser(userId: string, reason: string, durationHours?: number) {
    return this.request(`/api/admin/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason, duration_hours: durationHours }),
    });
  }

  unblockUser(userId: string) {
    return this.request(`/api/admin/users/${userId}/unblock`, {
      method: 'POST',
    });
  }

  deleteUser(userId: string) {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  updateUserProfile(userId: string, data: any) {
    return this.request(`/api/admin/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Settings
  getSettings() {
    return this.request('/api/settings');
  }

  updateSettings(data: any) {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Payments
  createCheckoutSession(bookingId: string) {
    return this.request(`/api/payments/checkout?booking_id=${bookingId}`, {
      method: 'POST',
    });
  }

  getPaymentStatus(sessionId: string) {
    return this.request(`/api/payments/status/${sessionId}`);
  }

  // Profile
  updateProfile(data: any) {
    return this.request('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new API();
