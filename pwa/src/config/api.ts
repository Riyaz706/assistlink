/**
 * API base URL for AssistLink backend.
 * Set VITE_API_BASE in .env (e.g. https://your-api.example.com) or default to relative.
 */
const env = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string> }).env : undefined;
export const API_BASE = (env?.VITE_API_BASE ?? '') as string;

/**
 * Optional: return current auth token for authenticated requests.
 * Implement with your auth provider (e.g. Supabase session).
 */
export function getAuthToken(): string | null {
  // Example: read from sessionStorage if you store Supabase access_token there
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('assistlink_access_token');
}
