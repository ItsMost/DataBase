import React, { useState } from 'react';
import { supabase } from '../supabase';

/**
 * The coach logs in with a single code.
 * Behind the scenes this is a normal Supabase Auth sign-in for one fixed account:
 * the code is that account's password. The code itself is NOT stored in the source.
 */
const COACH_EMAIL = 'coach@gym-solo.app';

export const LoginScreen: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!navigator.onLine) {
      setError('محتاج إنترنت لأول تسجيل دخول. بعد كده التطبيق هيشتغل أوفلاين.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: COACH_EMAIL,
      password: code.trim(),
    });
    setLoading(false);

    if (signInError) {
      setError('الكود غلط، جرّب تاني.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
      <div className="card-bg rounded-2xl p-6 w-full max-w-sm border border-theme">
        <h1 className="text-2xl font-black text-primary glow-text text-center mb-1">Gym Solo 🏋️‍♂️</h1>
        <p className="text-muted text-sm text-center mb-6 font-bold">اكتب كود الدخول</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Hidden username so the phone's password manager can remember the code */}
          <input type="text" name="username" autoComplete="username" value={COACH_EMAIL} readOnly hidden />
          <input
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="الكود"
            required
            autoFocus
            className="w-full input-bg rounded-lg px-3 py-3 text-base border border-theme text-center tracking-widest"
            style={{ direction: 'ltr' }}
          />

          {error && (
            <div className="text-danger text-xs font-bold bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-black rounded-lg py-3 transition-all active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
};
