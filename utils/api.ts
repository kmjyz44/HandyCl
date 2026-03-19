import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

// Backend URL - Use environment variable or fallback to hardcoded URL
const getBackendUrl = (): string => {
  // Try expo constants first
  const expoUrl = Constants.expoConfig?.extra?.backendUrl;
  if (expoUrl) {
    console.log('Using expo config URL:', expoUrl);
    return expoUrl;
  }
  
  // Try environment 
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log('Using env URL:', envUrl);
    return envUrl;
  }
  
  // Fallback to hardcoded URL
  const fallbackUrl = 'https://handyhub-preview-1.preview.emergentagent.com';
  console.log('Using fallback URL:', fallbackUrl);
  return fallbackUrl;
};

const API_URL = getBackendUrl();
console.log('Final API_URL:', API_URL);

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
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    config.signal = controller.signal;

    try {
      console.log('Sending request to:', url);
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        let errorDetail = 'Request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorDetail;
        } catch {
          errorDetail = errorText || errorDetail;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      console.log('Response success');
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('=== API Error ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your internet connection.');
      }
      if (error.message?.includes('Network request failed') || error.name === 'TypeError') {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
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

  getGoogleAuthUrl() {
    return this.request('/api/auth/google');
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

  // Executors
  getAllExecutors() {
    return this.request('/api/executors');
  }

  getAvailableExecutors(params?: { day_of_week?: number; location?: string; min_rating?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.day_of_week !== undefined) searchParams.append('day_of_week', params.day_of_week.toString());
    if (params?.location) searchParams.append('location', params.location);
    if (params?.min_rating) searchParams.append('min_rating', params.min_rating.toString());
    const queryString = searchParams.toString();
    return this.request(`/api/executors/available${queryString ? `?${queryString}` : ''}`);
  }

  getExecutorProfile(userId: string) {
    return this.request(`/api/profile/executor/${userId}`);
  }

  getMyExecutorProfile() {
    return this.request('/api/profile/executor');
  }

  createExecutorProfile(data: any) {
    return this.request('/api/profile/executor', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateExecutorProfile(data: any) {
    return this.request('/api/profile/executor', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Availability
  getExecutorAvailability(userId: string) {
    return this.request(`/api/availability/${userId}`);
  }

  getMyAvailability() {
    return this.request('/api/availability');
  }

  createAvailabilitySlot(data: any) {
    return this.request('/api/availability', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAvailabilitySlot(slotId: string, data: any) {
    return this.request(`/api/availability/${slotId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteAvailabilitySlot(slotId: string) {
    return this.request(`/api/availability/${slotId}`, {
      method: 'DELETE',
    });
  }

  // Pricing
  getExecutorPricing(executorId: string) {
    return this.request(`/api/pricing/${executorId}`);
  }

  // Client Tasks
  createClientTask(data: any) {
    const params = new URLSearchParams();
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        if (Array.isArray(data[key])) {
          // Skip arrays in params, will be in body
        } else {
          params.append(key, data[key].toString());
        }
      }
    });
    return this.request(`/api/client/tasks?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ photos: data.photos }),
    });
  }

  getClientTasks() {
    return this.request('/api/client/tasks');
  }

  // Tasker Tasks
  getAvailableTasks(category?: string) {
    const params = category ? `?category=${category}` : '';
    return this.request(`/api/tasker/available-tasks${params}`);
  }

  acceptTask(taskId: string) {
    return this.request(`/api/tasker/tasks/${taskId}/accept`, { method: 'POST' });
  }

  startTask(taskId: string) {
    return this.request(`/api/tasker/tasks/${taskId}/start`, { method: 'POST' });
  }

  onTheWayTask(taskId: string) {
    return this.request(`/api/tasker/tasks/${taskId}/on-the-way`, { method: 'POST' });
  }

  completeTask(taskId: string, data: any) {
    const params = new URLSearchParams({
      actual_hours: data.actual_hours.toString(),
    });
    if (data.materials_cost) params.append('materials_cost', data.materials_cost.toString());
    if (data.provider_notes) params.append('provider_notes', data.provider_notes);
    return this.request(`/api/tasker/tasks/${taskId}/complete?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ completion_photos: data.completion_photos }),
    });
  }

  // Offers
  createOffer(data: any) {
    return this.request('/api/offers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getBookingOffers(bookingId: string) {
    return this.request(`/api/offers/booking/${bookingId}`);
  }

  getMyOffers() {
    return this.request('/api/offers/my');
  }

  acceptOffer(offerId: string) {
    return this.request(`/api/offers/${offerId}/accept`, { method: 'POST' });
  }

  declineOffer(offerId: string) {
    return this.request(`/api/offers/${offerId}/decline`, { method: 'POST' });
  }

  withdrawOffer(offerId: string) {
    return this.request(`/api/offers/${offerId}`, { method: 'DELETE' });
  }

  // Earnings
  getEarnings() {
    return this.request('/api/earnings');
  }

  getEarningsHistory(limit: number = 50) {
    return this.request(`/api/earnings/history?limit=${limit}`);
  }

  // Categories
  getCategories() {
    return this.request('/api/categories');
  }

  // Promo codes
  validatePromoCode(code: string, amount: number) {
    return this.request(`/api/promo-codes/validate?code=${code}&amount=${amount}`, {
      method: 'POST',
    });
  }

  // Disputes
  createDispute(data: any) {
    return this.request('/api/disputes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getDisputes() {
    return this.request('/api/disputes');
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
}

export const api = new API();
