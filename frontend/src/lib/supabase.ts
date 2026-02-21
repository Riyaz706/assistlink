/**
 * Supabase client for web-only features (e.g. Realtime signaling for WebRTC).
 * Uses anon key; channel names are room IDs so only participants with the room ID can join.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
