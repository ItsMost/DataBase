/**
 * Subscription alerts in three groups + the payment choice dialog (full renewal / extras only).
 */
import React from 'react';
import { formatDate } from '../../lib/subscription';
import type { ActiveSectionVM } from '../../hooks/useActiveSection';

export const SubscriptionAlerts: React.FC<{ vm: ActiveSectionVM }> = ({ vm }) => {
  const { onPayExtras, analysisOf, setPayDialogPlayerId, extrasAmount, setExtrasAmount, startNormalRenewal, startFullRenewalWithExtras, inactiveAfterDays, playersWithExtras, outstandingGym, needsRenewal, inactivePlayers, alertBadgeCount, showInactive, setShowInactive, payDialogPlayer, getWhatsAppLink } = vm;
  return (
    <>
      {/* 1. Subscription alerts (three groups) */}
      <div className="card-bg rounded-lg p-4 border border-danger/30 relative overflow-hidden">
        <h3 className="text-sm font-bold text-danger mb-3 flex items-center gap-1.5 glow-text">
          ⚠️ تنبيهات الاشتراكات
          <span className="bg-danger text-white text-[10px] font-black px-2 py-0.5 rounded-full">{alertBadgeCount}</span>
        </h3>

        {/* (1) Needs renewal */}
        <div className="mb-3">
          <div className="text-xs font-black text-danger mb-1.5">
            🔁 محتاج يجدد ({needsRenewal.length})
            <span className="text-muted font-normal mr-1">خلص من {inactiveAfterDays} يوم أو أقل ومحضرش بعدها</span>
          </div>
          {needsRenewal.length === 0 ? (
            <div className="text-[11px] text-muted">مفيش ✅</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {needsRenewal.map(({ player: p }) => {
                const st = analysisOf(p).status;
                const waLink = getWhatsAppLink(p);
                return (
                  <div key={p.id} className="input-bg rounded p-2 flex justify-between items-center border border-danger/10 text-xs gap-2">
                    <div className="text-right">
                      <span className="font-bold text-main block">[#{p.number || '000'}] {p.name}</span>
                      <span className="text-danger text-[10px] font-semibold">
                        {st.endMode === 'sessions' ? 'خلصت حصصه' : 'خلص'} من {st.days} أيام ({p.subType})
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="bg-danger/20 text-danger px-2 py-1.5 rounded border border-danger/30 font-bold whitespace-nowrap">
                          تذكير 💬
                        </a>
                      )}
                      <button onClick={() => startNormalRenewal(p)}
                        className="bg-success/20 text-success px-2 py-1.5 rounded border border-success/30 font-bold whitespace-nowrap">
                        تجديد ♻️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* (2) Extra sessions with money owed (the coach paid the gym for them) */}
        <div className="mb-3 border-t border-theme/40 pt-3">
          <div className="text-xs font-black text-amber-400 mb-1">💸 حضر زيادة وعليه فلوس ({playersWithExtras.length})</div>
          <div className="text-[11px] text-muted mb-1.5">
            الفلوس اللي برّه: دفعت للجيم بدالهم <b className="text-amber-400">{outstandingGym} ج</b> ولسه مرجعتش
          </div>
          {playersWithExtras.length === 0 ? (
            <div className="text-[11px] text-muted">مفيش حصص زيادة متأخرة ✅</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {playersWithExtras.map(p => {
                const b = analysisOf(p).balance;
                const waLink = getWhatsAppLink(p);
                return (
                  <div key={p.id} className="input-bg rounded p-2 flex justify-between items-center border border-amber-500/20 text-xs gap-2">
                    <div className="text-right">
                      <span className="font-bold text-main block">[#{p.number || '000'}] {p.name}</span>
                      <span className="text-amber-400 text-[10px] font-bold">
                        {b.extraCount} حصص زيادة · من {formatDate(b.oldestDate || '')} · دفعت للجيم {b.gymAdvanced} ج
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="bg-amber-500/10 text-amber-400 px-2 py-1.5 rounded border border-amber-500/30 font-bold whitespace-nowrap">
                          💬
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setExtrasAmount('');
                          setPayDialogPlayerId(p.id);
                        }}
                        className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-1.5 rounded font-bold whitespace-nowrap"
                      >
                        دفع 💰
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* (3) Inactive: collapsed by default */}
        <div className="border-t border-theme/40 pt-3">
          <button
            type="button"
            onClick={() => setShowInactive(v => !v)}
            className="w-full flex justify-between items-center text-xs font-black text-muted"
          >
            <span>💤 مش نشط ({inactivePlayers.length}) <span className="font-normal">أكتر من {inactiveAfterDays} يوم من غير حضور</span></span>
            <span>{showInactive ? 'إخفاء ▲' : 'عرض ▼'}</span>
          </button>
          {showInactive && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {inactivePlayers.length === 0 ? (
                <div className="text-[11px] text-muted">مفيش</div>
              ) : (
                inactivePlayers.map(({ player: p, idle }) => {
                  const waLink = getWhatsAppLink(p);
                  return (
                    <div key={p.id} className="input-bg rounded p-2 flex justify-between items-center border border-theme text-xs gap-2 opacity-80">
                      <div className="text-right">
                        <span className="font-bold text-main block">[#{p.number || '000'}] {p.name}</span>
                        <span className="text-muted text-[10px]">آخر نشاط من {idle} يوم ({p.subType})</span>
                      </div>
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="input-bg text-muted px-2 py-1.5 rounded border border-theme font-bold whitespace-nowrap">
                          تذكير 💬
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {payDialogPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-theme text-right">
            <h3 className="text-lg font-bold text-primary mb-1">دفع: {payDialogPlayer.name}</h3>
            <p className="text-xs text-amber-400 font-bold mb-4">
              حضر {analysisOf(payDialogPlayer).balance.extraCount} حصص زيادة · دفعت للجيم بداله {analysisOf(payDialogPlayer).balance.gymAdvanced} ج
            </p>

            <button
              onClick={() => startFullRenewalWithExtras(payDialogPlayer)}
              className="w-full btn-primary font-bold rounded-md px-4 py-3 mb-1"
            >
              ♻️ تجديد اشتراك كامل
            </button>
            <p className="text-[10px] text-muted mb-4 leading-relaxed">
              الحصص الزيادة بتتحسب من الباقة الجديدة (البداية = أول حصة زيادة)، وفلوس الجيم بتاعتها بتتخصم من تكلفة الباقة.
            </p>

            <div className="border-t border-theme pt-3">
              <label className="text-xs text-muted font-bold block mb-1">دفع الحصص الزيادة بس — المبلغ اللي دفعه (ج)</label>
              <input
                type="number"
                value={extrasAmount}
                onChange={(e) => setExtrasAmount(e.target.value)}
                placeholder="اكتب المبلغ"
                className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme mb-2"
              />
              <button
                disabled={extrasAmount === '' || isNaN(parseFloat(extrasAmount))}
                onClick={async () => {
                  const b = analysisOf(payDialogPlayer).balance;
                  await onPayExtras(payDialogPlayer.id, parseFloat(extrasAmount) || 0, b.extraDates, analysisOf(payDialogPlayer).currentSub?.place);
                  setPayDialogPlayerId(null);
                  setExtrasAmount('');
                }}
                className="w-full bg-amber-500 text-white font-bold rounded-md px-4 py-2 disabled:opacity-40"
              >
                💰 دفع الحصص الزيادة بس
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              {payDialogPlayer.subType && (
                <button
                  onClick={() => {
                    setPayDialogPlayerId(null);
                    startNormalRenewal(payDialogPlayer);
                  }}
                  className="w-1/2 input-bg font-bold rounded-md px-3 py-2 text-xs border border-theme"
                >
                  تجديد من النهارده
                </button>
              )}
              <button
                onClick={() => setPayDialogPlayerId(null)}
                className={`${payDialogPlayer.subType ? 'w-1/2' : 'w-full'} input-bg font-bold rounded-md px-3 py-2 text-xs border border-theme`}
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
