/**
 * Supabase client for web-only features (e.g. Realtime signaling for WebRTC).
 * Uses anon key; channel names are room IDs so only participants with the room ID can join.
 * Reads from process.env (dev) or expoConfig.extra (EAS/build) so built app has config.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string | undefined {
  const fromEnv = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  try {
    const c = require('expo-constants').default?.expoConfig?.extra;
    const fromExtra = c?.EXPO_PUBLIC_SUPABASE_URL;
    if (fromExtra && String(fromExtra).trim()) return String(fromExtra).trim();
  } catch {}
  return undefined;
}
function getSupabaseAnonKey(): string | undefined {
  const fromEnv = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  try {
    const c = require('expo-constants').default?.expoConfig?.extra;
    const fromExtra = c?.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (fromExtra && String(fromExtra).trim()) return String(fromExtra).trim();
  } catch {}
  return undefined;
}

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
