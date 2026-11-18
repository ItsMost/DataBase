import React, { useEffect, useState } from 'react';
import App from '../App';
import { LoginScreen } from './LoginScreen';
import { supabase, hasStoredSession } from '../services/supabaseClient';
import { processSyncQueue } from '../services/sync';

type GateState = 'checking' | 'in' | 'out';

/**
 * Shows the login screen until the coach has a session.
 * supabase-js persists the session in localStorage, so after the first login
 * the app opens straight away — even offline with an expired access token
 * (the refresh token stays stored and is used once the network is back).
 * Local Dexie data is never touched by login/logout.
 */
export const AuthGate: React.FC = () => {
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    document.body.setAttribute('data-mode', localStorage.getItem('sys_mode') || 'dark');

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setState('in');
      } else {
        // Offline + expired token: getSession() returns null but keeps the stored
        // session (retryable network error). Let the coach in to use local data.
        setState(hasStoredSession() ? 'in' : 'out');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState('out');
        return;
      }
      if (session) {
        setState('in');
        // Realtime and REST must use the coach's token (RLS blocks anon).
        supabase.realtime.setAuth(session.access_token);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Push anything queued while offline / while the token was expired.
          processSyncQueue();
        }
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === 'checking') return <div className="min-h-screen" />;
  if (state === 'out') return <LoginScreen />;
  return <App />;
};
