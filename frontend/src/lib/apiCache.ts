/**
 * Local API response cache - PRD: IndexedDB / local data caching.
 * Uses AsyncStorage for React Native; provides offline-first for caregivers list, bookings, etc.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'assistlink_cache_';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function cacheKey(url: string, params?: Record<string, string>): string {
  const base = url.replace(/[^a-zA-Z0-9-_]/g, '_');
  if (!params || Object.keys(params).length === 0) return CACHE_PREFIX + base;
  const qs = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return CACHE_PREFIX + base + '_' + qs.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export async function getCached<T>(url: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const key = cacheKey(url, params);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  url: string,
  data: T,
  params?: Record<string, string>,
  ttlMs = DEFAULT_TTL_MS
): Promise<void> {
  try {
    const key = cacheKey(url, params);
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn('[apiCache] setCached failed:', e);
  }
}

export async function invalidateCache(urlPattern?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = urlPattern
      ? keys.filter(k => k.startsWith(CACHE_PREFIX) && k.includes(urlPattern))
      : keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.warn('[apiCache] invalidateCache failed:', e);
  }
}
