/**
 * Supabase client (auth session is saved on the device so the app opens offline).
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://koakdlbwsjekmtiunfhr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYWtkbGJ3c2pla210aXVuZmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDEyNDUsImV4cCI6MjA4OTcxNzI0NX0.ZTXsET8hhtIebRmXiv1fHELmReGjVJlrq7HdlO9uWMI';

const AUTH_STORAGE_KEY = 'sb-koakdlbwsjekmtiunfhr-auth-token';

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
