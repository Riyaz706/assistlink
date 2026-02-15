// API URL: env var, Constants.extra, or fallback to Render production
function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, ''); // strip trailing slash
  try {
    const Constants = require('expo-constants').default;
    const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl || Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
    if (fromExtra) return String(fromExtra).replace(/\/$/, '');
  } catch { }
  return 'https://assistlink-nd65.onrender.com';
}
const API_BASE_URL = getApiBaseUrl();

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'assistlink_token';
const REFRESH_TOKEN_KEY = 'assistlink_refresh_token';

// Log the API base URL on initialization (helps debug connection issues)
if (typeof window !== 'undefined') {
  console.log(`[API] API Base URL: ${API_BASE_URL}`);
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Offline handling integration
type OfflineHandler = (path: string, options: RequestInit) => Promise<any>;
let offlineHandler: OfflineHandler | null = null;

export function setOfflineHandler(handler: OfflineHandler | null) {
  offlineHandler = handler;
}

// Helper to get token from storage
async function getTokenFromStorage(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

// Helper to get refresh token
async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return null;
  }
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

// Helper to set refresh token
export async function setRefreshToken(token: string | null) {
  if (!token) {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
    return;
  }

  if (Platform.OS === 'web') {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as any),
  };

  // Always try to get the token - first from module variable, then from storage
  let token = accessToken;
  if (!token) {
    token = await getTokenFromStorage();
    if (token) {
      accessToken = token; // Cache it for next time
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  console.log(`[API] Making ${options.method || 'GET'} request to: ${url}`);

  // Set timeout for requests (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`[API] Response received: ${res.status} ${res.statusText} for ${path}`);

    // Get request ID from response headers for debugging
    const requestId = res.headers.get('X-Request-ID');
    if (requestId) {
      console.log(`[API] Request ID: ${requestId}`);
    }

    const text = await res.text();

    if (!res.ok) {
      let errorMessage = text || `Request failed with status ${res.status}`;
      let errorCode = `HTTP_${res.status}`;
      let errorDetails = null;

      try {
        const json = JSON.parse(text);

        // Handle new standardized error format
        if (json.error) {
          errorMessage = json.error.message || errorMessage;
          errorCode = json.error.code || errorCode;
          errorDetails = json.error.details;
        }
        // Handle legacy format
        else if (json.detail) {
          errorMessage = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
        }
      } catch {
        // ignore JSON parse error, keep text
      }

      // Create enhanced error object
      const error: any = new Error(errorMessage);
      error.statusCode = res.status;
      error.code = errorCode;
      error.details = errorDetails;
      error.requestId = requestId;

      // Add diagnostic info
      const diagnosticMsg = `API Error [${res.status}${requestId ? ` - ${requestId}` : ''}] at ${url}: ${errorMessage}`;
      console.error(`[API] ${diagnosticMsg}`);

      if (errorDetails) {
        console.error(`[API] Error details:`, errorDetails);
      }

      throw error;
    }

    if (!text) {
      // no body
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.error(`[API] Failed to parse response JSON for ${path}:`, text.substring(0, 100));
      throw new Error(`Invalid JSON response from server`);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);

    const extendedOptions = options as any;
    if (error.statusCode === 401 && !extendedOptions._retry) {
      // Token expired, try to refresh
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          console.log('[API] Token expired, attempting refresh...');
          // Call refresh endpoint - assuming /api/auth/refresh exists and takes refresh_token body or header
          // NOTE: Using a fresh fetch here to avoid circular dependency or interceptor loop
          const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccessToken = refreshData.access_token;
            const newRefreshToken = refreshData.refresh_token;

            if (newAccessToken) {
              console.log('[API] Token refresh successful');
              setAccessToken(newAccessToken);
              // If we got a new refresh token, save it too
              if (newRefreshToken) {
                await setRefreshToken(newRefreshToken);
              }
              // Also update storage for the access token to keep them in sync
              if (Platform.OS === 'web') {
                window.localStorage.setItem(TOKEN_KEY, newAccessToken);
              } else {
                await SecureStore.setItemAsync(TOKEN_KEY, newAccessToken);
              }

              // Retry original request with new token
              return request(path, { ...options, _retry: true } as any);
            }
          } else {
            console.warn('[API] Token refresh failed');
            // Clear tokens
            setAccessToken(null);
            await setRefreshToken(null);
            // Let the error propagate so the UI can redirect to login
          }
        } catch (refreshError) {
          console.error('[API] Error during token refresh:', refreshError);
        }
      }
    }

    // Handle abort/timeout
    if (error.name === 'AbortError') {
      const timeoutError: any = new Error('Request timeout. Please check your internet connection and try again.');
      timeoutError.code = 'TIMEOUT';
      timeoutError.statusCode = 408;
      console.error(`[API] Request timeout for ${path}`);
      throw timeoutError;
    }

    // Handle network errors and offline queueing
    const isNetwork = error.message && (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed') ||
      error.message.includes('Unable to connect to the server')
    );

    if (isNetwork) {
      console.error(`[API] Network error for ${path}`);

      const method = options.method || 'GET';
      if (offlineHandler && isSyncable(path, method)) {
        console.log(`[API] Network error caught, attempting to queue syncable request: ${method} ${path}`);
        try {
          await offlineHandler(path, options);
          return { queued: true, status: 'pending' } as any;
        } catch (queueError) {
          console.error('[API] Failed to queue request:', queueError);
        }
      }

      const networkError: any = new Error(`Network error: Unable to connect to the server. Please check your internet connection.`);
      networkError.code = 'NETWORK_ERROR';
      networkError.originalError = error;
      throw networkError;
    }

    // Re-throw other errors as-is (they already have enhanced info if from !res.ok block)
    throw error;
  }
}

// Define which endpoints are "syncable" offline
const SYNCABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SYNCABLE_PATHS = [
  '/api/bookings',
  '/api/chat/sessions',
  '/api/caregivers/profile',
  '/api/notifications/devices'
];

function isSyncable(path: string, method: string): boolean {
  if (!SYNCABLE_METHODS.includes(method.toUpperCase())) return false;
  return SYNCABLE_PATHS.some(p => path.startsWith(p));
}

export const api = {
  // Expose raw request for internal use (like syncing)
  request,
  // Authentication
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    date_of_birth?: string;
    role: "care_recipient" | "caregiver";
    address?: any;
    profile_photo_url?: string | null;
  }) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      user: any;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  googleAuth: (payload: {
    id_token: string;
    role: "care_recipient" | "caregiver";
    full_name?: string;
    profile_photo_url?: string;
  }) =>
    request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      user: any;
    }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload: { email: string }) =>
    request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request("/api/auth/me"),

  // Users
  getProfile: () => request("/api/users/profile"),

  updateProfile: (data: Partial<{
    full_name: string;
    phone: string;
    date_of_birth: string;
    address: any;
    profile_photo_url: string;
    emergency_contact: { name: string; phone: string } | null;
  }>) =>
    request("/api/users/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Notifications
  getNotifications: (opts: {
    limit?: number;
    offset?: number;
    unread_only?: boolean;
    is_read?: boolean;
    type?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (opts.limit != null) qs.append("limit", String(opts.limit));
    if (opts.offset != null) qs.append("offset", String(opts.offset));
    if (opts.unread_only) qs.append("unread_only", "true");
    if (opts.is_read != null) qs.append("is_read", String(opts.is_read));
    if (opts.type) qs.append("type", opts.type);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/notifications${query}`);
  },

  markAllNotificationsRead: () =>
    request("/api/notifications/read-all", {
      method: "POST",
    }),

  markNotificationRead: (notificationId: string) =>
    request(`/api/notifications/${notificationId}/read`, {
      method: "POST",
    }),

  deleteNotification: (notificationId: string) =>
    request(`/api/notifications/${notificationId}`, {
      method: "DELETE",
    }),

  registerDevice: (data: {
    device_token: string;
    platform: string;
    device_info?: any;
  }) =>
    request("/api/notifications/devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  unregisterDevice: (deviceToken: string) =>
    request(`/api/notifications/devices/${deviceToken}`, {
      method: "DELETE",
    }),

  createTestNotification: () =>
    request("/api/notifications/test", {
      method: "POST",
    }),

  // Caregivers
  listCaregivers: (params: {
    availability_status?: string;
    min_rating?: number;
    skills?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.availability_status) qs.append("availability_status", params.availability_status);
    if (params.min_rating != null) qs.append("min_rating", String(params.min_rating));
    if (params.skills) qs.append("skills", params.skills);
    if (params.limit != null) qs.append("limit", String(params.limit));
    if (params.offset != null) qs.append("offset", String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/caregivers${query}`);
  },

  // Video call (short intro call)
  createVideoCallRequest: (data: {
    caregiver_id: string;
    scheduled_time: string; // ISO datetime
    duration_seconds?: number;
  }) =>
    request("/api/bookings/video-call/request", {
      method: "POST",
      body: JSON.stringify({
        caregiver_id: data.caregiver_id,
        scheduled_time: data.scheduled_time,
        duration_seconds: data.duration_seconds ?? 15,
      }),
    }),

  acceptVideoCallRequest: (videoCallId: string, accept: boolean) =>
    request(`/api/bookings/video-call/${videoCallId}/accept`, {
      method: "POST",
      body: JSON.stringify({ accept }),
    }),

  updateVideoCallStatus: (videoCallId: string, status: string) =>
    request(`/api/bookings/video-call/${videoCallId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  completeBooking: (bookingId: string) =>
    request(`/api/bookings/${bookingId}/complete`, {
      method: "POST",
    }),

  joinVideoCall: (videoCallId: string) =>
    request(`/api/bookings/video-call/${videoCallId}/join`, {
      method: "POST",
    }),

  getVideoCallRequest: (videoCallId: string) =>
    request(`/api/bookings/video-call/${videoCallId}`),

  // Bookings
  createBooking: (data: {
    service_type: "exam_assistance" | "daily_care" | "one_time" | "recurring";
    scheduled_date: string; // ISO datetime
    duration_hours?: number;
    location?: any;
    specific_needs?: string;
    is_recurring?: boolean;
    recurring_pattern?: any;
    caregiver_id?: string;
  }) =>
    request("/api/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBooking: (bookingId: string, data: { status?: string;[key: string]: any }) =>
    request(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  cancelBooking: (bookingId: string) =>
    request(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }),

  // Dashboard
  getDashboardStats: () => request("/api/dashboard/stats"),

  getDashboardBookings: (params: {
    status?: string;
    is_recurring?: boolean;
    upcoming_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.append("status", params.status);
    if (params.is_recurring != null) qs.append("is_recurring", String(params.is_recurring));
    if (params.upcoming_only) qs.append("upcoming_only", "true");
    if (params.limit != null) qs.append("limit", String(params.limit));
    if (params.offset != null) qs.append("offset", String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/dashboard/bookings${query}`);
  },

  getDashboardVideoCalls: (params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.append("status", params.status);
    if (params.limit != null) qs.append("limit", String(params.limit));
    if (params.offset != null) qs.append("offset", String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/dashboard/video-calls${query}`);
  },

  // Payments
  createPaymentOrder: (data: {
    booking_id: string;
    amount: number;
    currency?: string;
  }) =>
    request<{
      order_id: string;
      amount: number;
      currency: string;
      key_id: string;
      booking_id: string;
      chat_session_id?: string;
    }>("/api/payments/create-order", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    request<{
      success: boolean;
      message: string;
      booking_id?: string;
      chat_session_id?: string;
    }>("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Bookings
  completePayment: (bookingId: string) =>
    request(`/api/bookings/${bookingId}/complete-payment`, {
      method: "POST",
    }),


  // Caregiver Profile
  getCaregiverProfile: () => request("/api/caregivers/profile"),
  updateCaregiverProfile: (data: { availability_status?: string;[key: string]: any }) =>
    request("/api/caregivers/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Chat
  getChatSessions: () => request("/api/chat/sessions"),

  getChatSession: (chatSessionId: string) =>
    request(`/api/chat/sessions/${chatSessionId}`),

  getMessages: (chatSessionId: string, params: {
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.append("limit", String(params.limit));
    if (params.offset != null) qs.append("offset", String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/chat/sessions/${chatSessionId}/messages${query}`);
  },

  sendMessage: (chatSessionId: string, data: {
    content: string;
    message_type?: string;
    attachment_url?: string;
  }) =>
    request(`/api/chat/sessions/${chatSessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: data.content,
        message_type: data.message_type || "text",
        attachment_url: data.attachment_url,
      }),
    }),

  markMessagesAsRead: (chatSessionId: string) =>
    request(`/api/chat/sessions/${chatSessionId}/read`, {
      method: "POST",
    }),

  // Emergency
  triggerEmergency: (data: { location?: any } = {}) =>
    request("/api/emergency/trigger", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};


