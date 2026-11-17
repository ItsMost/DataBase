import React, { useState } from 'react';
import { supabase } from '../supabase';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError('الإيميل أو الباسورد غلط، جرّب تاني.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
      <div className="card-bg rounded-2xl p-6 w-full max-w-sm border border-theme">
        <h1 className="text-2xl font-black text-primary glow-text text-center mb-1">Gym Solo 🏋️‍♂️</h1>
        <p className="text-muted text-sm text-center mb-6 font-bold">تسجيل دخول المدرب</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted font-bold block mb-1">الإيميل</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full input-bg rounded-lg px-3 py-3 text-sm border border-theme"
              style={{ direction: 'ltr' }}
            />
          </div>
          <div>
            <label className="text-xs text-muted font-bold block mb-1">الباسورد</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full input-bg rounded-lg px-3 py-3 text-sm border border-theme"
              style={{ direction: 'ltr' }}
            />
          </div>

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
