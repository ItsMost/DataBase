/**
 * Advanced settings: accounting settings, month lock, emergency tools, sign out.
 */
import React from 'react';
import { SettingsPanel } from '../SettingsPanel';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const AdvancedSettings: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { onImportJSON, onDeepRecover, lockedMonths, currentMonthKey, onLockMonth, onSignOut, onSaveSettings, settings, showLockModal, setShowLockModal, lockConfirmText, setLockConfirmText, showSignOutConfirm, setShowSignOutConfirm } = vm;
  return (
    <>
      {/* Advanced settings */}
      <div className="card-bg rounded-lg p-5 border-t-2 border-slate-500 relative animate-fadeIn">
        <h2 className="text-lg font-bold text-main mb-4 flex items-center">⚙️ إعدادات متقدمة</h2>

        <SettingsPanel settings={settings} onSave={onSaveSettings} />

        <div className="input-bg rounded-lg border border-theme p-4 mb-4">
          <div className="font-black text-amber-400 mb-1">🔒 قفل الشهر ({currentMonthKey})</div>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            قفل الشهر بيعلّم الشهر إنه مقفول وبس. مش بيمسح أي مدفوعات أو حضور أو اشتراكات، والتقارير الشهرية هتفضل شايفة أرقامه.
          </p>
          {lockedMonths.includes(currentMonthKey) ? (
            <div className="text-amber-400 text-sm font-black">الشهر ده مقفول بالفعل 🔒</div>
          ) : (
            <button
              onClick={() => {
                setLockConfirmText('');
                setShowLockModal(true);
              }}
              className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/50 py-2 rounded-lg font-bold hover:bg-amber-500 hover:text-white transition-all"
            >
              قفل الشهر 🔒
            </button>
          )}
          {lockedMonths.length > 0 && (
            <div className="text-[11px] text-muted mt-3">
              الشهور المقفولة: {[...lockedMonths].sort().reverse().join('، ')}
            </div>
          )}
        </div>

        {/* Emergency tools (moved here from the backup section) */}
        <div className="input-bg rounded-lg border border-red-500/30 p-4 mb-4">
          <div className="font-black text-red-400 mb-1">🧰 أدوات الطوارئ</div>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            قبل أي استرجاع بتتعمل نسخة احتياطية أوتوماتيك، وبيظهرلك كام لاعب هيتغير قبل التأكيد. مفيش لاعب بيتمسح.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onImportJSON}
              className="bg-green-500/20 text-green-400 border border-green-500/50 py-2 rounded-lg font-bold text-xs hover:bg-green-500 hover:text-white transition-all"
            >
              لصق (Import) 📥
            </button>
            <button
              onClick={onDeepRecover}
              className="bg-red-500/20 text-red-400 border border-red-500/50 py-2 rounded-lg font-bold text-xs hover:bg-red-500 hover:text-white transition-all"
            >
              الفحص العميق 🔄
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="w-full bg-danger/10 text-danger border border-danger/40 py-3 rounded-lg font-bold hover:bg-danger hover:text-white transition-all"
        >
          تسجيل خروج 🚪
        </button>
      </div>

      {showLockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-6 w-full max-w-sm text-center border border-theme">
            <h3 className="text-xl font-bold text-amber-400 mb-2">قفل شهر {currentMonthKey}</h3>
            <p className="text-main text-sm mb-4">
              مفيش أي بيانات هتتمسح. اكتب كلمة <b className="text-amber-400">تأكيد</b> علشان تقفل الشهر.
            </p>
            <input
              type="text"
              value={lockConfirmText}
              onChange={(e) => setLockConfirmText(e.target.value)}
              placeholder="تأكيد"
              className="w-full input-bg rounded-lg px-3 py-2 text-sm border border-theme mb-4 text-center"
            />
            <div className="flex gap-3">
              <button
                disabled={lockConfirmText.trim() !== 'تأكيد'}
                onClick={async () => {
                  await onLockMonth(currentMonthKey);
                  setShowLockModal(false);
                  setLockConfirmText('');
                }}
                className="w-1/2 bg-amber-500 text-white font-bold rounded-md px-4 py-2 disabled:opacity-40"
              >
                قفل
              </button>
              <button
                onClick={() => setShowLockModal(false)}
                className="w-1/2 input-bg font-bold rounded-md px-4 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-6 w-full max-w-sm text-center border border-theme">
            <h3 className="text-xl font-bold text-danger mb-2">تسجيل خروج</h3>
            <p className="text-main text-sm mb-6">
              بياناتك هتفضل محفوظة على الجهاز. هتحتاج إنترنت علشان تدخل تاني.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setShowSignOutConfirm(false);
                  await onSignOut();
                }}
                className="w-1/2 bg-danger text-white font-bold rounded-md px-4 py-2"
              >
                خروج
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="w-1/2 input-bg font-bold rounded-md px-4 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
