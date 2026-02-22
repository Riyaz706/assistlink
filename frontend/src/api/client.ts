// Centralized config: no localhost/127.0.0.1/10.0.2.2 — all devices must use shared reachable URL.
const { getApiBaseUrlFromEnv, validateNoLoopback, logNetworkFailure } = require('../config/network');

function getDefaultApiBaseUrl(): string {
  return getApiBaseUrlFromEnv();
}

// Mutable base URL so user can change it in Settings when IP changes (no rebuild needed)
let currentBaseUrl = getDefaultApiBaseUrl();

const API_OVERRIDE_KEY = 'assistlink_api_base_url_override';

async function loadApiBaseUrlOverride(): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const override = await AsyncStorage.getItem(API_OVERRIDE_KEY);
    if (override && override.trim()) {
      currentBaseUrl = override.trim().replace(/\/$/, '');
      if (typeof window !== 'undefined') {
        console.log(`[API] Using override Base URL: ${currentBaseUrl}`);
      }
    }
    const validation = validateNoLoopback(currentBaseUrl);
    if (!validation.valid) {
      console.error(`[API] ${validation.message}`);
    }
  } catch {
    // ignore
  }
}

/** Resolve before first API call so auth restore uses override if set */
export const apiConfigReady = loadApiBaseUrlOverride();

/** Get the URL currently used for API requests */
export function getCurrentApiBaseUrl(): string {
  return currentBaseUrl;
}

/** Get the default URL from env/build (before any override) */
export function getDefaultApiUrl(): string {
  return getDefaultApiBaseUrl();
}

/**
 * Check if the backend is reachable (GET /health). Use to verify app–backend connection.
 * Uses current base URL (or optional urlOverride to test a URL before saving).
 */
export async function checkBackendConnection(urlOverride?: string | null): Promise<{ ok: boolean; message?: string }> {
  const base = urlOverride != null && urlOverride.trim() ? urlOverride.trim().replace(/\/$/, '') : currentBaseUrl;
  const url = `${base}/health`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.status === 'ok' || data?.message)) {
      return { ok: true, message: data.message || 'Backend is reachable.' };
    }
    return { ok: false, message: data?.message || `Backend returned ${res.status}` };
  } catch (e: any) {
    clearTimeout(timeoutId);
    const msg = e?.name === 'AbortError'
      ? 'Request timed out. Is the backend running and reachable at this URL?'
      : (e?.message || 'Network error. Check URL, Wi‑Fi, and that backend is running.');
    return { ok: false, message: msg };
  }
}

/**
 * Set or clear backend URL override. Use when your machine's IP changes so the app
 * can reach the backend without rebuilding. Pass null or '' to use default again.
 */
export async function setApiBaseUrlOverride(url: string | null): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  if (!url || !url.trim()) {
    await AsyncStorage.removeItem(API_OVERRIDE_KEY);
    currentBaseUrl = getDefaultApiBaseUrl();
    if (typeof window !== 'undefined') {
      console.log(`[API] Cleared override, using default: ${currentBaseUrl}`);
    }
  } else {
    const u = url.trim().replace(/\/$/, '');
    await AsyncStorage.setItem(API_OVERRIDE_KEY, u);
    currentBaseUrl = u;
    if (typeof window !== 'undefined') {
      console.log(`[API] Override set to: ${currentBaseUrl}`);
    }
  }
}

// ── Global Request Deduplication Lock ────────────────────────────────────────
// Prevents API spam: if identical GET requests fire concurrently, they share
// one in-flight promise instead of issuing N parallel requests.
const _inflight = new Map<string, Promise<any>>();

export function deduplicatedRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (_inflight.has(key)) return _inflight.get(key) as Promise<T>;
  const promise = fn().finally(() => _inflight.delete(key));
  _inflight.set(key, promise);
  return promise;
}
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'assistlink_token';
const REFRESH_TOKEN_KEY = 'assistlink_refresh_token';

// Startup: validate and log BASE_URL (never use localhost/127.0.0.1/10.0.2.2 for multi-device testing)
if (typeof window !== 'undefined') {
  const validation = validateNoLoopback(currentBaseUrl);
  if (validation.valid) {
    console.log(`[API] Base URL: ${currentBaseUrl}`);
  } else {
    console.error(`[API] ${validation.message}`);
  }
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
  if (!currentBaseUrl || !currentBaseUrl.trim()) {
    const err: any = new Error(
      'API base URL is not set. Set EXPO_PUBLIC_API_BASE_URL in .env to your backend URL (LAN IP for multi-device testing, e.g. http://192.168.1.x:8000, or production HTTPS).'
    );
    err.code = 'CONFIG';
    logNetworkFailure('request', err, currentBaseUrl || '(empty)');
    throw err;
  }

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

  const url = `${currentBaseUrl}${path}`;
  console.log(`[API] Making ${options.method || 'GET'} request to: ${url}`);

  // Timeout: longer for auth (startup/restore) and for list endpoints (cold backend/Supabase can be slow)
  const isAuthEndpoint = path === '/api/auth/me' || path === '/api/auth/refresh' || path.startsWith('/api/auth/login');
  const isListEndpoint = path === '/api/caregivers' || path.startsWith('/api/caregivers?');
  const timeoutMs = isAuthEndpoint ? 60000 : isListEndpoint ? 45000 : 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

      // Show a short message instead of raw backend DB connection errors
      if (errorMessage && (
        errorMessage.includes("Database connection failed") ||
        errorMessage.includes("database pool") ||
        errorMessage.includes("Network is unreachable") ||
        (errorMessage.includes("db.") && errorMessage.includes("supabase.co") && errorMessage.includes("5432"))
      )) {
        errorMessage = "Service is temporarily unavailable. Please try again in a moment.";
      }

      // Create enhanced error object
      const error: any = new Error(errorMessage);
      error.statusCode = res.status;
      error.code = errorCode;
      error.details = errorDetails;
      error.requestId = requestId;

      // Add diagnostic info (409 is expected for terminal-state conflicts, log as warn)
      const diagnosticMsg = `API Error [${res.status}${requestId ? ` - ${requestId}` : ''}] at ${url}: ${errorMessage}`;
      if (res.status === 409) {
        console.warn(`[API] ${diagnosticMsg}`);
      } else {
        console.error(`[API] ${diagnosticMsg}`);
      }

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
          const refreshRes = await fetch(`${currentBaseUrl}/api/auth/refresh`, {
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
          setAccessToken(null);
          await setRefreshToken(null).catch(() => {});
        }
      }
    }

    // Handle abort/timeout
    if (error.name === 'AbortError') {
      const timeoutError: any = new Error('Request timeout. Please check your internet connection and try again.');
      timeoutError.code = 'TIMEOUT';
      timeoutError.statusCode = 408;
      logNetworkFailure(`Request timeout for ${path}`, timeoutError, `${currentBaseUrl}${path}`);
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
      logNetworkFailure(`Network error for ${path}`, error, `${currentBaseUrl}${path}`);

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

  /** Get a single caregiver's profile by ID (e.g. for detail view when selecting a caregiver). */
  getCaregiver: (caregiverId: string) =>
    request<{ id: string; full_name?: string; profile_photo_url?: string; caregiver_profile?: any }>(`/api/caregivers/${caregiverId}`),

  /** Busy slots for a caregiver in a date range (accepted/confirmed/in_progress). Use before booking to show free vs busy. */
  getCaregiverBusySlots: (caregiverId: string, fromIso: string, toIso: string) =>
    request<{ start: string; end: string }[]>(`/api/caregivers/${caregiverId}/busy-slots?from_date=${encodeURIComponent(fromIso)}&to_date=${encodeURIComponent(toIso)}`),

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

  /** Start an instant video call from an existing chat session (either party can start). */
  createVideoCallFromChat: (chatSessionId: string) =>
    request<{ id: string; video_call_url?: string }>("/api/bookings/video-call/from-chat", {
      method: "POST",
      body: JSON.stringify({ chat_session_id: chatSessionId }),
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
    request(`/api/bookings/video-call/${videoCallId}`, { method: "GET" }),

  completeVideoCall: (bookingId: string) =>
    request(`/api/bookings/video-call/${bookingId}/complete`, {
      method: "POST",
    }),

  // Bookings
  createBooking: (data: {
    service_type: "exam_assistance" | "daily_care" | "one_time" | "recurring" | "urgent_care" | string;
    scheduled_date: string; // ISO datetime
    duration_hours?: number;
    location?: any;
    specific_requirements?: string;
    urgency_level?: string;
    is_recurring?: boolean;
    recurring_pattern?: any;
    caregiver_id?: string;
  }) =>
    request("/api/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),



  getBooking: (bookingId: string) =>
    request<any>(`/api/bookings/${bookingId}`),

  updateBooking: (bookingId: string, data: { status?: string;[key: string]: any }) =>
    request(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Polling-based subscription for realtime updates (fallback for missing supabase-js)
  subscribeToBooking: (bookingId: string, callback: (data: any) => void, intervalMs = 5000) => {
    // Initial fetch
    request(`/api/bookings/${bookingId}`).then(data => callback(data)).catch(err => console.error("Poll error", err));

    const intervalId = setInterval(() => {
      request(`/api/bookings/${bookingId}`)
        .then(data => callback(data))
        .catch(err => console.error("Poll error", err));
    }, intervalMs);
    return intervalId;
  },

  unsubscribeFromBooking: (subscriptionHandle: any) => {
    if (subscriptionHandle) clearInterval(subscriptionHandle);
  },

  cancelBooking: (bookingId: string, reason?: string) =>
    request(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", reason }),
    }),

  respondToBooking: (bookingId: string, status: "accepted" | "rejected", reason?: string) =>
    request(`/api/bookings/${bookingId}/respond`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),

  updateBookingStatus: (bookingId: string, status: string, reason?: string) =>
    request(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),

  getBookingHistory: (bookingId: string) =>
    request<any[]>(`/api/bookings/${bookingId}/history`),

  addBookingNote: (bookingId: string, note: string, isPrivate: boolean = false) =>
    request(`/api/bookings/${bookingId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note, is_private: isPrivate }),
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
    return request(`/api/dashboard/video-calls${query}`, { method: "GET" });
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
    request("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Video call room info (WebRTC uses room_name as signaling room ID; token unused)
  getVideoToken: (bookingId: string) =>
    request<{ token: string | null; room_name: string; identity: string }>("/api/communications/video/token", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId }),
    }),


  // Bookings: complete-payment is not a backend route; use payments/verify for payment completion.
  // This method is kept for backwards compatibility but points to video-call complete (backend accepts booking_id or video_call_id).
  completePayment: (id: string) =>
    request(`/api/bookings/video-call/${id}/complete`, {
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

  acknowledgeEmergency: (emergencyId: string) =>
    request(`/api/emergency/${emergencyId}/acknowledge`, {
      method: "POST",
    }),

  resolveEmergency: (emergencyId: string) =>
    request(`/api/emergency/${emergencyId}/resolve`, {
      method: "POST",
    }),

  getEmergencyStatus: (emergencyId: string) =>
    request(`/api/emergency/status/${emergencyId}`),

  // Reviews
  submitReview: (data: {
    booking_id: string;
    rating: number;
    comment?: string;
  }) =>
    request("/api/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCaregiverReviews: (caregiverId: string) =>
    request(`/api/reviews/caregiver/${caregiverId}`),

  getBookingReview: (bookingId: string) =>
    request(`/api/reviews/booking/${bookingId}`),

  // Support & Feedback
  contactSupport: (data: { email: string; message: string }) =>
    request("/api/communications/support", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submitAppFeedback: (content: string) =>
    request("/api/communications/feedback", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};


// ── Global Safe API Wrapper ───────────────────────────────────────────────────
/**
 * safeApi(fn, fallback?)
 *
 * Wraps any api.* call so that 404 / 500 errors are caught silently.
 * - 401 → re-throws so AuthContext can handle logout
 * - 404 → returns fallback (default null), logs warn
 * - 500 → returns fallback (default null), logs warn
 * - network error → returns fallback, logs warn
 *
 * Usage:
 *   const data = await safeApi(() => api.getDashboardStats(), null);
 */
export async function safeApi<T>(
  fn: () => Promise<T>,
  fallback: T | null = null
): Promise<T | null> {
  try {
    return await fn();
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? 0;
    // 401 must propagate so AuthContext can force logout
    if (status === 401) throw err;
    // 404 / 500 / network — swallow and return fallback
    if (status === 404) {
      console.warn(`[safeApi] 404 Not Found — returning fallback`);
    } else if (status >= 500) {
      console.warn(`[safeApi] ${status} Server Error — returning fallback: ${err?.message}`);
    } else {
      console.warn(`[safeApi] Error (${status}) — returning fallback: ${err?.message}`);
    }
    return fallback;
  }
}
