/**
 * Supabase client (auth session is saved on the device so the app opens offline).
 */
import { createClient } from '@supabase/supabase-js';

// Values come from environment variables (.env.local locally, Vercel settings in production).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Same key supabase-js uses by default ("sb-<project>-auth-token"), so existing logins are kept.
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});

/** True if a coach session is saved on this device (even if its access token expired). */
export function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return false;
  }
}
