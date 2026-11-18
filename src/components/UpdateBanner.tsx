import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Small bar shown when a new version of the app is ready.
 * Nothing reloads by itself: the update happens only when the coach taps it.
 */
export const UpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-sm card-bg border border-theme rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-lg"
      dir="rtl"
    >
      <span className="text-xs font-bold text-main">فيه تحديث جديد 🔄</span>
      <div className="flex gap-1">
        <button
          onClick={() => {
            // Reload once the new version takes control (only after this tap).
            // workbox alone skips the reload when the browser found the update by itself.
            navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true });
            updateServiceWorker(true);
          }}
          className="text-white text-xs font-black rounded-md px-3 py-1.5"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          حدّث دلوقتي
        </button>
        <button onClick={() => setNeedRefresh(false)} className="input-bg text-xs rounded-md px-2 py-1.5 border border-theme">
          بعدين
        </button>
      </div>
    </div>
  );
};
