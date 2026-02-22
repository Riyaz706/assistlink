/**
 * Centralized network configuration — single source of truth for API base URL.
 * CRITICAL: No localhost, 127.0.0.1, or 10.0.2.2. All clients (emulators, devices)
 * must use a shared reachable URL (LAN IP, tunnel, or production).
 */

export type AppEnv = 'development' | 'staging' | 'production';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2'];
const PRODUCTION_DEFAULT = 'https://assistlink-backend-1qjd.onrender.com';

function getAppEnv(): AppEnv {
  const env = (process.env.EXPO_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  if (env === 'production' || env === 'prod') return 'production';
  if (env === 'staging' || env === 'stage') return 'staging';
  return 'development';
}

function isLoopback(url: string): boolean {
  const u = url.replace(/\/$/, '').toLowerCase();
  return LOOPBACK_HOSTS.some((host) => u.includes(host));
}

/**
 * Returns the API base URL from env or build extra. No localhost substitution.
 * Production fallback only when APP_ENV is production.
 */
export function getApiBaseUrlFromEnv(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  try {
    const Constants = require('expo-constants').default;
    const fromExtra =
      Constants.expoConfig?.extra?.apiBaseUrl ||
      Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
    if (fromExtra && String(fromExtra).trim()) {
      return String(fromExtra).trim().replace(/\/$/, '');
    }
  } catch {
    // ignore
  }
  const env = getAppEnv();
  if (env === 'production') {
    return PRODUCTION_DEFAULT;
  }
  // Development/staging: no default; caller must ensure env is set or validation will fail
  return '';
}

export function getAppEnvironment(): AppEnv {
  return getAppEnv();
}

/**
 * Validates that the API base URL is not a loopback address.
 * Use at startup to block App ↔ App testing failures.
 */
export function validateNoLoopback(baseUrl: string): { valid: boolean; message: string } {
  if (!baseUrl || !baseUrl.trim()) {
    return {
      valid: false,
      message:
        'EXPO_PUBLIC_API_BASE_URL is not set. Set it to your backend URL (LAN IP for dev, e.g. http://192.168.1.x:8000, or production HTTPS). Never use localhost/127.0.0.1/10.0.2.2 for multi-device testing.',
    };
  }
  const url = baseUrl.trim().replace(/\/$/, '');
  if (isLoopback(url)) {
    return {
      valid: false,
      message: `[NETWORK] EXPO_PUBLIC_API_BASE_URL must NOT be localhost, 127.0.0.1, or 10.0.2.2. Use your machine's LAN IP (e.g. http://192.168.1.x:8000) or a tunnel so all emulators/devices can reach the backend. Current value: ${url}`,
    };
  }
  return { valid: true, message: '' };
}

/**
 * Log network failure with actionable message (no silent failures).
 */
export function logNetworkFailure(context: string, error: unknown, url?: string): void {
  const msg = error instanceof Error ? error.message : String(error);
  const u = url || '';
  console.error(
    `[NETWORK] ${context} failed: ${msg}. URL: ${u}. Ensure backend is reachable from this device (LAN IP or tunnel, not localhost).`
  );
}
