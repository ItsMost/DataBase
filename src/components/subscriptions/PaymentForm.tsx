/**
 * Subscription & payment form (end mode, gym/place money, place).
 */
import React from 'react';
import type { Player } from '../../types';
import { isPackageType, formatDate, SINGLE_SESSION } from '../../lib/subscription';
import { EndModePicker, GymCostField, PlaceField } from '../AccountingFields';
import { PACKAGE_OPTIONS, SINGLE_SESSION_LABEL } from '../../lib/constants';
import type { ActiveSectionVM } from '../../hooks/useActiveSection';

export const PaymentForm: React.FC<{ vm: ActiveSectionVM }> = ({ vm }) => {
  const { players, setSelectedPlayerId, getTodayDate, subType, setSubType, startDate, setStartDate, paid, setPaid, placeSuggestions, cost, setCost, costTouched, setCostTouched, endMode, setEndMode, place, setPlace, absorbed, setAbsorbed, absorbedGym, editingMode, setEditingMode, playerSearch, setPlayerSearch, showPlayerDropdown, setShowPlayerDropdown, dropdownRef, handleSubmitSub } = vm;
  return (
    <>
      {/* Payment / Sub Form */}
      <div className="card-bg rounded-lg p-5 mb-6 border-t-2 border-theme">
        <h2 className="text-lg font-bold text-primary mb-4 flex items-center">
          <svg className="w-5 h-5 ml-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {editingMode ? 'تعديل الاشتراك والدفع الحالي' : 'تسجيل اشتراك ودفع'}
        </h2>
        <form onSubmit={handleSubmitSub} className="space-y-3">
          {/* Searchable Dropdown for Player Selection */}
          <div className="relative w-full text-right" ref={dropdownRef}>
            <input
              type="text"
              value={playerSearch}
              onFocus={() => setShowPlayerDropdown(true)}
              onChange={(e) => {
                setPlayerSearch(e.target.value);
                setShowPlayerDropdown(true);
                // Clear selected player if they type something custom, to prevent saving with wrong ID
                const match = players.find(
                  p => !p.isDeleted && `[#${p.number || '000'}] ${p.name}` === e.target.value
                );
                if (match) {
                  setSelectedPlayerId(match.id);
                } else {
                  setSelectedPlayerId('');
                }
              }}
              placeholder="🔍 ابحث عن اللاعب بالاسم أو الرقم لاختياره..."
              className="w-full input-bg rounded-md px-4 py-3 text-right text-sm"
              dir="rtl"
            />
            {showPlayerDropdown && (
              <div className="absolute z-50 w-full max-h-48 overflow-y-auto input-bg border border-theme rounded-md shadow-lg mt-1 pr-1">
                {players
                  .filter(p => !p.isSystem && !p.isDeleted)
                  .filter(p => {
                    const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                    // If user typed some search keyword, filter by it. Otherwise show all.
                    const typedText = playerSearch.includes(']')
                      ? playerSearch.split(']').slice(1).join(' ').trim().toLowerCase()
                      : playerSearch.trim().toLowerCase();
                    return searchStr.includes(typedText);
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPlayerId(p.id);
                        setPlayerSearch(`[#${p.number || '000'}] ${p.name}`);
                        setShowPlayerDropdown(false);
                        setEditingMode(null);
                      }}
                      className="cursor-pointer px-4 py-2 hover:bg-primary-glow/20 transition-all text-right text-sm border-b border-theme/20 last:border-0"
                    >
                      <span className="text-primary-light font-bold">[#{p.number || '---'}]</span>{' '}
                      <span className="text-main">{p.name}</span>
                    </div>
                  ))}
                {players.filter(p => !p.isSystem && !p.isDeleted).filter(p => {
                  const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                  const typedText = playerSearch.includes(']')
                    ? playerSearch.split(']').slice(1).join(' ').trim().toLowerCase()
                    : playerSearch.trim().toLowerCase();
                  return searchStr.includes(typedText);
                }).length === 0 && (
                  <div className="text-muted text-xs text-center py-3">لا يوجد لاعب مطابق.</div>
                )}
              </div>
            )}
          </div>

          <select
            value={subType}
            onChange={(e) => setSubType(e.target.value)}
            className="w-full input-bg rounded-md px-4 py-3"
          >
            <option value={SINGLE_SESSION}>{SINGLE_SESSION_LABEL}</option>
            {PACKAGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {isPackageType(subType) && (
            <EndModePicker value={endMode} onChange={setEndMode} />
          )}

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full input-bg rounded-md px-4 py-3"
          />

          {absorbed.length > 0 && (
            <div className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 leading-relaxed">
              تجديد كامل: الباقة بتبدأ من أول حصة زيادة ({formatDate(absorbed[0].date)}) و{absorbed.length} حصص زيادة اتحسبوا منها.
              اتخصم {absorbedGym} ج من فلوس الجيم لأنك دفعتهم قبل كده.
              <button
                type="button"
                onClick={() => {
                  setAbsorbed([]);
                  setStartDate(getTodayDate());
                }}
                className="block mt-1 text-muted underline"
              >
                إلغاء الخصم والبدء من النهارده
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted font-bold block mb-1">دفع كام؟ (ج)</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                placeholder="المبلغ"
                className="w-full input-bg rounded-md px-4 py-3"
              />
            </div>
            <GymCostField
              value={cost}
              onChange={(v) => {
                setCost(v);
                setCostTouched(true);
              }}
              onReset={() => setCostTouched(false)}
              touched={costTouched}
            />
          </div>

          <PlaceField value={place} onChange={setPlace} suggestions={placeSuggestions} listId="subPlaceList" />

          <button
            type="submit"
            className="w-full btn-primary font-bold rounded-md px-4 py-3 active:scale-95 transition-all"
          >
            {editingMode ? 'حفظ تعديلات الاشتراك ✏️' : 'تأكيد الدفع (ACCEPT)'}
          </button>
        </form>
      </div>
    </>
  );
};
