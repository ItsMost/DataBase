import React, { useEffect, useState } from 'react';
import { processSyncQueue, type SyncInfo } from '../services/sync';

/** Chrome's "install app" event (not in the standard DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface HeaderProps {
  mode: string;
  setMode: (mode: string) => void;
  syncStatus: 'online' | 'offline' | 'syncing';
  syncInfo: SyncInfo;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  syncStatus,
  syncInfo,
}) => {
  const [showSyncError, setShowSyncError] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const toggleMode = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'online':
        return (
          <span className="text-success text-[10px] bg-success/20 px-2 py-0.5 rounded-full border border-success transition-all whitespace-nowrap">
            ☁️ متصل (Supabase)
          </span>
        );
      case 'offline':
        return (
          <span className="text-danger text-[10px] bg-danger/20 px-2 py-0.5 rounded-full border border-danger transition-all whitespace-nowrap">
            ☁️ أوفلاين
          </span>
        );
      case 'syncing':
        return (
          <span className="text-primary-light text-[10px] bg-primary/20 px-2 py-0.5 rounded-full border border-primary transition-all animate-pulse whitespace-nowrap">
            ☁️ جاري المزامنة...
          </span>
        );
    }
  };

  return (
    <div className="flex justify-between items-center px-4 pt-4 pb-2">
      {/* Branding */}
      <h1 className="text-lg sm:text-xl font-black tracking-wide flex items-center gap-2 text-primary glow-text select-none">
        Gym Solo 🏋️‍♂️
      </h1>

      {/* Sync and Actions */}
      <div className="flex gap-2 items-center">
        {getSyncStatusBadge()}
        {syncInfo.pending > 0 && !syncInfo.error && (
          <span
            className="text-amber-400 text-[10px] bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/40 whitespace-nowrap"
            title="تعديلات محفوظة على الموبايل ولسه مرفعتش على السحابة"
          >
            ⏳ {syncInfo.pending} مستني
          </span>
        )}
        {syncInfo.error && (
          <button
            onClick={() => setShowSyncError(true)}
            className="text-white text-[10px] font-black bg-danger px-2 py-0.5 rounded-full border border-danger whitespace-nowrap animate-pulse"
          >
            ⚠️ خطأ في المزامنة{syncInfo.pending > 0 ? ` (${syncInfo.pending})` : ''}
          </button>
        )}
        {deferredPrompt && (
          <button
            onClick={handleInstallApp}
            className="px-3 py-1 bg-green-500/20 text-success font-bold rounded-full border border-success text-xs shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all active:scale-95"
          >
            تثبيت التطبيق 📱
          </button>
        )}
        <button
          onClick={toggleMode}
          className="p-2 rounded-full card-bg text-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
        >
          {mode === 'light' ? '☀️' : '🌙'}
        </button>
      </div>

      {showSyncError && syncInfo.error && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" dir="rtl">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-danger/50 text-right">
            <h3 className="text-lg font-bold text-danger mb-2">⚠️ خطأ في المزامنة</h3>
            <p className="text-sm text-main mb-2">
              فيه {syncInfo.pending} تعديل محفوظين على الموبايل ومرفعوش على السحابة. مفيش حاجة ضاعت.
            </p>
            <pre className="input-bg rounded p-2 text-[11px] whitespace-pre-wrap font-sans border border-theme mb-4" dir="auto">{syncInfo.error}</pre>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSyncError(false);
                  processSyncQueue();
                }}
                className="w-1/2 text-white font-bold rounded px-3 py-2"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                حاول تاني 🔄
              </button>
              <button onClick={() => setShowSyncError(false)} className="w-1/2 input-bg font-bold rounded px-3 py-2 border border-theme">
                قفل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

