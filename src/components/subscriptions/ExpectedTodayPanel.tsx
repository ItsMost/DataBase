/**
 * "Expected today" list: add, edit, register in one tap.
 */
import React from 'react';
import {
  suggestGymCost,
  isPackageType,
  SINGLE_SESSION,
  ATTEND_ONLY_TYPES,
  DEFAULT_PLACE,
} from '../../lib/subscription';
import { EndModePicker, GymCostField, PlaceField } from '../AccountingFields';
import { PACKAGE_OPTIONS, SINGLE_SESSION_LABEL, ATTEND_ONLY_MONTHLY } from '../../lib/constants';
import type { ActiveSectionVM } from '../../hooks/useActiveSection';

export const ExpectedTodayPanel: React.FC<{ vm: ActiveSectionVM }> = ({ vm }) => {
  const { players, getTodayDate, expectedAttendees, onAddExpectedAttendee, onDeleteExpectedAttendee, onApplyExpectedAttendee, onSaveExpectedAttendee, allGroups, settings, placeSuggestions, expName, setExpName, selectedExpPlayerId, setSelectedExpPlayerId, expGroup, setExpGroup, expPaid, setExpPaid, expSubType, setExpSubType, expTime, setExpTime, expCost, setExpCost, expCostTouched, setExpCostTouched, expEndMode, setExpEndMode, expPlace, setExpPlace, showExpDropdown, setShowExpDropdown, expDropdownRef, editingExpId, setEditingExpId, editingExpTime, setEditingExpTime, editingExpGroup, setEditingExpGroup, editingExpPaid, setEditingExpPaid, editingExpSubType, setEditingExpSubType, editingExpCost, setEditingExpCost, getHourlySummary, sortedExpected } = vm;
  return (
    <>
      {/* 2. Expected Today Panel */}
      <div className="card-bg rounded-lg p-5 border-t-2 border-primary relative">
        <h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-1.5 glow-text pr-2">
          📋 المتوقع حضورهم اليوم ({expectedAttendees.length})
        </h2>
        <p className="text-xs text-muted mb-2 leading-relaxed pr-2">
          سجل اللاعبين المتوقع حضورهم اليوم لتسجيلهم الفعلي كلاعبين وتفعيل الدفع وتأكيد الحضور بضغطة واحدة.
        </p>

        {/* Hourly summary displays here if expected attendees exist */}
        {expectedAttendees.length > 0 && (
          <div className="text-[10px] sm:text-xs text-primary-light font-semibold bg-primary-glow/10 border border-theme/40 rounded px-3 py-2 text-center mb-4 dir-rtl leading-relaxed">
            📢 {getHourlySummary()}
          </div>
        )}

        {/* Expected Today Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!expName.trim()) {
              alert("الرجاء اختيار لاعب من القائمة!");
              return;
            }

            // Enforce choosing a registered player
            const match = players.find(
              p => !p.isSystem && !p.isDeleted && (p.id === selectedExpPlayerId || p.name.trim().toLowerCase() === expName.trim().toLowerCase())
            );

            if (!match) {
              alert("⚠️ لا يمكن إضافة اسم غير مسجل! الرجاء كتابة اسم لاعب مسجل واختياره من القائمة بالقاعدة.");
              return;
            }

            await onAddExpectedAttendee({
              name: match.name,
              playerId: match.id,
              sport: expGroup.trim() || match.sport || 'العام',
              paid: parseFloat(expPaid) || 0,
              subType: expSubType,
              date: getTodayDate(),
              time: expTime,
              cost: ATTEND_ONLY_TYPES.includes(expSubType) ? undefined : expCost,
              endMode: isPackageType(expSubType) ? expEndMode : undefined,
              place: expPlace.trim() || DEFAULT_PLACE,
            });
            setExpName('');
            setSelectedExpPlayerId('');
            setExpPaid('');
            setExpGroup('');
            setExpTime('');
            setExpCostTouched(false);
            setExpEndMode('sessions');
            setExpPlace(DEFAULT_PLACE);
          }}
          className="space-y-3 border-b border-theme/30 pb-4 mb-4"
        >
          {/* Searchable Dropdown for Expected Player Name */}
          <div className="relative w-full text-right" ref={expDropdownRef}>
            <input
              type="text"
              value={expName}
              onFocus={() => setShowExpDropdown(true)}
              onChange={(e) => {
                setExpName(e.target.value);
                setShowExpDropdown(true);
                const match = players.find(p => !p.isSystem && !p.isDeleted && p.name === e.target.value);
                if (match) {
                  setSelectedExpPlayerId(match.id);
                  setExpGroup(match.sport || 'العام');
                  if (match.subType && match.subType !== SINGLE_SESSION) {
                    setExpSubType(ATTEND_ONLY_MONTHLY);
                    setExpPaid('');
                  } else {
                    setExpSubType(SINGLE_SESSION);
                  }
                } else {
                  setSelectedExpPlayerId('');
                }
              }}
              placeholder="🔍 ابحث عن اسم اللاعب بالقاعدة لاختياره..."
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right"
              dir="rtl"
            />
            {showExpDropdown && (
              <div className="absolute z-50 w-full max-h-48 overflow-y-auto input-bg border border-theme rounded-md shadow-lg mt-1 pr-1">
                {players
                  .filter(p => !p.isSystem && !p.isDeleted)
                  .filter(p => {
                    const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                    const typedText = expName.trim().toLowerCase();
                    return searchStr.includes(typedText);
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setExpName(p.name);
                        setSelectedExpPlayerId(p.id);
                        setExpGroup(p.sport || 'العام');
                        if (p.subType && p.subType !== SINGLE_SESSION) {
                          setExpSubType(ATTEND_ONLY_MONTHLY);
                          setExpPaid('');
                        } else {
                          setExpSubType(SINGLE_SESSION);
                        }
                        setShowExpDropdown(false);
                      }}
                      className="cursor-pointer px-4 py-2 hover:bg-primary-glow/20 transition-all text-right text-xs border-b border-theme/20 last:border-0"
                    >
                      <span className="text-primary-light font-bold">[#{p.number || '---'}]</span>{' '}
                      <span className="text-main">{p.name}</span>
                      {p.sport && <span className="text-muted text-[10px] mr-2">({p.sport})</span>}
                    </div>
                  ))}
                {players.filter(p => !p.isSystem && !p.isDeleted).filter(p => {
                  const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                  const typedText = expName.trim().toLowerCase();
                  return searchStr.includes(typedText);
                }).length === 0 && (
                  <div className="text-muted text-xs text-center py-3">لا يوجد لاعب مطابق بالقاعدة.</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={expGroup}
              onChange={(e) => setExpGroup(e.target.value)}
              placeholder="الجروب (اكتب أو اختر)"
              list="expGroupSuggestions"
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right"
            />
            <datalist id="expGroupSuggestions">
              {allGroups.map((g, idx) => (
                <option key={idx} value={g} />
              ))}
            </datalist>

            <select
              value={expSubType}
              onChange={(e) => setExpSubType(e.target.value)}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme"
            >
              <option value={ATTEND_ONLY_MONTHLY}>{ATTEND_ONLY_MONTHLY}</option>
              <option value={SINGLE_SESSION}>{SINGLE_SESSION_LABEL}</option>
              {PACKAGE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={expTime}
              onChange={(e) => setExpTime(e.target.value)}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right text-muted"
            />
            <input
              type="number"
              value={expPaid}
              onChange={(e) => setExpPaid(e.target.value)}
              placeholder="سيدفع كام؟"
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right"
            />
          </div>

          {isPackageType(expSubType) && (
            <EndModePicker value={expEndMode} onChange={setExpEndMode} />
          )}

          {!ATTEND_ONLY_TYPES.includes(expSubType) && (
            <div className="grid grid-cols-2 gap-2">
              <GymCostField
                value={expCost}
                onChange={(v) => {
                  setExpCost(v);
                  setExpCostTouched(true);
                }}
                onReset={() => setExpCostTouched(false)}
                touched={expCostTouched}
                compact
              />
              <PlaceField value={expPlace} onChange={setExpPlace} suggestions={placeSuggestions} listId="expPlaceList" compact />
            </div>
          )}

          <button
            type="submit"
            className="w-full btn-primary font-bold rounded-md text-xs py-3 shadow-md active:scale-95 transition-all"
          >
            + إضافة لقائمة المتوقع اليوم
          </button>
        </form>

        {/* Expected Today List */}
        <div className="max-h-60 overflow-y-auto pr-1 space-y-3">
          {expectedAttendees.length === 0 ? (
            <div className="text-xs text-muted text-center py-4 border border-dashed border-theme rounded">
              لا يوجد لاعبين متوقع حضورهم مسجلين اليوم.
            </div>
          ) : (
            sortedExpected.map(att => {
              const displayTime = (() => {
                if (!att.time) return '';
                const [hStr, mStr] = att.time.split(':');
                const hourNum = parseInt(hStr, 10);
                const ampm = hourNum >= 12 ? 'م' : 'ص';
                const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
                return `${hour12}:${mStr || '00'} ${ampm}`;
              })();

              const isEditing = editingExpId === att.id;

              return (
                <div
                  key={att.id}
                  className="input-bg rounded-lg p-3 border border-theme/60 flex flex-col gap-2 shadow-sm"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="border-b border-theme/20 pb-2 flex justify-between items-center">
                        <span className="font-bold text-primary-light text-sm">{att.name} (تعديل)</span>
                        <span className="text-[10px] text-muted">{att.date}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">موعد الحضور</label>
                          <input
                            type="time"
                            value={editingExpTime}
                            onChange={(e) => setEditingExpTime(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-muted text-xs text-right"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">الجروب</label>
                          <input
                            type="text"
                            value={editingExpGroup}
                            onChange={(e) => setEditingExpGroup(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs text-right"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">نوع الاشتراك</label>
                          <select
                            value={editingExpSubType}
                            onChange={(e) => setEditingExpSubType(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs"
                          >
                            <option value={ATTEND_ONLY_MONTHLY}>{ATTEND_ONLY_MONTHLY}</option>
                            <option value={SINGLE_SESSION}>{SINGLE_SESSION_LABEL}</option>
                            {PACKAGE_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">سيدفع</label>
                          <input
                            type="number"
                            value={editingExpPaid}
                            onChange={(e) => setEditingExpPaid(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs text-right"
                          />
                        </div>
                      </div>

                      {!ATTEND_ONLY_TYPES.includes(editingExpSubType) && (
                        <div className="text-xs">
                          <label className="text-[9px] text-muted block mb-0.5">للجيم / المكان (ج)</label>
                          <input
                            type="number"
                            value={editingExpCost}
                            onChange={(e) => setEditingExpCost(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs text-right"
                          />
                        </div>
                      )}

                      <div className="flex gap-2 pt-1 border-t border-theme/20">
                        <button
                          onClick={async () => {
                            await onSaveExpectedAttendee({
                              ...att,
                              time: editingExpTime,
                              sport: editingExpGroup,
                              paid: parseFloat(editingExpPaid) || 0,
                              subType: editingExpSubType,
                              cost: ATTEND_ONLY_TYPES.includes(editingExpSubType)
                                ? undefined
                                : (editingExpCost === ''
                                    ? suggestGymCost(settings, editingExpSubType, parseFloat(editingExpPaid) || 0)
                                    : parseFloat(editingExpCost) || 0),
                            });
                            setEditingExpId(null);
                          }}
                          className="w-1/2 bg-success text-white text-[11px] font-bold py-1.5 rounded hover:opacity-90 active:scale-95 transition-all border border-success/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        >
                          حفظ التعديلات ✅
                        </button>
                        <button
                          onClick={() => setEditingExpId(null)}
                          className="w-1/2 bg-zinc-500/20 text-zinc-300 text-[11px] font-semibold py-1.5 rounded hover:bg-zinc-500 hover:text-white active:scale-95 transition-all border border-zinc-500/30"
                        >
                          إلغاء ✖️
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center border-b border-theme/20 pb-2">
                        <span className="font-bold text-primary-light text-sm">{att.name}</span>
                        <div className="flex gap-2 items-center">
                          {att.time && (
                            <span className="text-[10px] text-primary-light font-bold bg-primary-glow/20 px-2 py-0.5 rounded">
                              🕒 {displayTime}
                            </span>
                          )}
                          <span className="text-[10px] text-muted">{att.date}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-muted block text-[10px]">الجروب</span>
                          <span className="text-main font-semibold">{att.sport}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">الاشتراك</span>
                          <span className="text-primary font-semibold">{att.subType}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">سيدفع</span>
                          <span className="text-success font-bold">{att.paid} ج</span>
                        </div>
                        {!ATTEND_ONLY_TYPES.includes(att.subType) && (
                          <div>
                            <span className="text-muted block text-[10px]">للجيم</span>
                            <span className="text-danger font-bold">
                              {typeof att.cost === 'number' ? att.cost : suggestGymCost(settings, att.subType, att.paid || 0)} ج
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => onApplyExpectedAttendee(att)}
                          className="w-1/3 bg-success text-white text-[10px] font-bold py-1.5 rounded hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-0.5 border border-success/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        >
                          <span>تسجيل 🟢</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingExpId(att.id);
                            setEditingExpTime(att.time || '');
                            setEditingExpGroup(att.sport || '');
                            setEditingExpPaid(String(att.paid || 0));
                            setEditingExpSubType(att.subType || SINGLE_SESSION);
                            setEditingExpCost(typeof att.cost === 'number' ? String(att.cost) : '');
                          }}
                          className="w-1/3 bg-primary/20 text-primary-light text-[10px] font-bold py-1.5 rounded hover:bg-primary hover:text-white active:scale-95 transition-all border border-primary/30"
                        >
                          تعديل ✏️
                        </button>
                        <button
                          onClick={() => att.id !== undefined && onDeleteExpectedAttendee(att.id)}
                          className="w-1/3 bg-danger/10 text-danger text-[10px] font-semibold py-1.5 rounded hover:bg-danger hover:text-white active:scale-95 transition-all border border-danger/20"
                        >
                          إلغاء 🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
