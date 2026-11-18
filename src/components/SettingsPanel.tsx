import React, { useState } from 'react';
import type { AppSettings } from '../types';
import {
  currentGymRate,
  localToday,
  formatDate,
  DEFAULT_INACTIVE_DAYS,
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_RECEIPT_TEMPLATE,
} from '../lib/subscription';
import { REMINDER_VARIABLES, RECEIPT_VARIABLES } from '../lib/messages';

interface SettingsPanelProps {
  settings: AppSettings;
  onSave: (next: AppSettings) => Promise<void>;
}

/**
 * Gym share per session (locked until "تعديل") and the discounted packages table.
 * Saved in the synced 'sys_settings' record. A new rate only applies from today on,
 * so sessions that were already counted keep their old price.
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSave }) => {
  const rate = currentGymRate(settings);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(rate));

  const [editingTiers, setEditingTiers] = useState(false);
  const [threshold, setThreshold] = useState(String(settings.discountThreshold));
  const [tiers, setTiers] = useState(settings.discountTiers.map(t => ({ sessions: String(t.sessions), cost: String(t.cost) })));

  const [editingAlerts, setEditingAlerts] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(String(settings.inactiveAfterDays ?? DEFAULT_INACTIVE_DAYS));
  const [editingTexts, setEditingTexts] = useState(false);
  const [reminderText, setReminderText] = useState(settings.waReminderTemplate || DEFAULT_REMINDER_TEMPLATE);
  const [receiptText, setReceiptText] = useState(settings.waReceiptTemplate || DEFAULT_RECEIPT_TEMPLATE);

  const saveAlerts = async () => {
    const n = parseInt(inactiveDays, 10);
    if (!Number.isFinite(n) || n < 1) return;
    await onSave({ ...settings, inactiveAfterDays: n });
    setEditingAlerts(false);
  };

  const saveTexts = async () => {
    await onSave({ ...settings, waReminderTemplate: reminderText, waReceiptTemplate: receiptText });
    setEditingTexts(false);
  };

  const saveRate = async () => {
    const value = parseFloat(rateInput);
    if (!Number.isFinite(value) || value < 0) return;
    const today = localToday();
    const gymRates = [...settings.gymRates.filter(r => r.from !== today), { from: today, rate: value }]
      .sort((a, b) => a.from.localeCompare(b.from));
    await onSave({ ...settings, gymRates });
    setEditingRate(false);
  };

  const saveTiers = async () => {
    const clean = tiers
      .map(t => ({ sessions: parseInt(t.sessions, 10), cost: parseFloat(t.cost) }))
      .filter(t => Number.isFinite(t.sessions) && t.sessions > 0 && Number.isFinite(t.cost) && t.cost >= 0)
      .sort((a, b) => a.sessions - b.sessions);
    await onSave({ ...settings, discountThreshold: parseFloat(threshold) || 0, discountTiers: clean });
    setEditingTiers(false);
  };

  return (
    <div className="input-bg rounded-lg border border-theme p-4 mb-4 space-y-4">
      <div className="font-black text-primary">💰 إعدادات الحسابات</div>

      {/* Gym share per session */}
      <div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted font-bold">نصيب الجيم للحصة</span>
          {!editingRate && (
            <button
              onClick={() => {
                setRateInput(String(rate));
                setEditingRate(true);
              }}
              className="text-[11px] text-primary underline font-bold"
            >
              تعديل
            </button>
          )}
        </div>
        {editingRate ? (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="flex-1 input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            <button onClick={saveRate} className="btn-primary px-3 py-2 rounded-md text-xs font-bold">حفظ</button>
            <button onClick={() => setEditingRate(false)} className="input-bg px-3 py-2 rounded-md text-xs border border-theme">إلغاء</button>
          </div>
        ) : (
          <div className="text-xl font-black text-main mt-1">{rate} ج</div>
        )}
        <p className="text-[10px] text-muted mt-1">
          الرقم الجديد بيتطبق من يوم الحفظ بس. الحصص اللي اتحسبت قبل كده بتفضل بسعرها القديم.
        </p>
        {settings.gymRates.length > 1 && (
          <div className="text-[10px] text-muted mt-1">
            السجل: {settings.gymRates.map(r => `${r.rate} ج من ${r.from <= '2000-12-31' ? 'البداية' : formatDate(r.from)}`).join(' · ')}
          </div>
        )}
      </div>

      {/* Discounted packages */}
      <div className="border-t border-theme/50 pt-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted font-bold">الباقات المخفضة (تكلفة الجيم)</span>
          {!editingTiers && (
            <button
              onClick={() => {
                setThreshold(String(settings.discountThreshold));
                setTiers(settings.discountTiers.map(t => ({ sessions: String(t.sessions), cost: String(t.cost) })));
                setEditingTiers(true);
              }}
              className="text-[11px] text-primary underline font-bold"
            >
              تعديل
            </button>
          )}
        </div>

        {editingTiers ? (
          <div className="space-y-2">
            <label className="text-[11px] text-muted block">بتتطبق لو المدفوع ≥</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            {tiers.map((t, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="number"
                  value={t.sessions}
                  onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, sessions: e.target.value } : x)))}
                  className="w-1/3 input-bg rounded-md px-2 py-2 text-sm border border-theme"
                  placeholder="حصص"
                />
                <span className="text-xs text-muted">حصة ←</span>
                <input
                  type="number"
                  value={t.cost}
                  onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))}
                  className="flex-1 input-bg rounded-md px-2 py-2 text-sm border border-theme"
                  placeholder="ج"
                />
                <button
                  onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                  className="text-danger text-xs px-2"
                  title="شيل الباقة"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => setTiers([...tiers, { sessions: '', cost: '' }])}
              className="text-[11px] text-primary underline"
            >
              + باقة
            </button>
            <div className="flex gap-2 pt-1">
              <button onClick={saveTiers} className="w-1/2 btn-primary py-2 rounded-md text-xs font-bold">حفظ</button>
              <button onClick={() => setEditingTiers(false)} className="w-1/2 input-bg py-2 rounded-md text-xs border border-theme">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-main space-y-1">
            <div className="text-muted text-[11px]">لو المدفوع ≥ {settings.discountThreshold} ج:</div>
            {settings.discountTiers.map(t => (
              <div key={t.sessions} className="flex justify-between">
                <span>{t.sessions} حصص</span>
                <span className="font-bold">{t.cost} ج</span>
              </div>
            ))}
            <div className="text-[10px] text-muted">أي باقة مش في الجدول (زي الـ 10 حصص) بتتحسب نصيب الحصة × عدد الحصص.</div>
          </div>
        )}
      </div>

      {/* Alerts: days before a player counts as inactive */}
      <div className="border-t border-theme/50 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted font-bold">التنبيهات: "مش نشط" بعد كام يوم؟</span>
          {!editingAlerts && (
            <button
              onClick={() => {
                setInactiveDays(String(settings.inactiveAfterDays ?? DEFAULT_INACTIVE_DAYS));
                setEditingAlerts(true);
              }}
              className="text-[11px] text-primary underline font-bold"
            >
              تعديل
            </button>
          )}
        </div>
        {editingAlerts ? (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              value={inactiveDays}
              onChange={(e) => setInactiveDays(e.target.value)}
              className="flex-1 input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            <button onClick={saveAlerts} className="btn-primary px-3 py-2 rounded-md text-xs font-bold">حفظ</button>
            <button onClick={() => setEditingAlerts(false)} className="input-bg px-3 py-2 rounded-md text-xs border border-theme">إلغاء</button>
          </div>
        ) : (
          <div className="text-xl font-black text-main mt-1">{settings.inactiveAfterDays ?? DEFAULT_INACTIVE_DAYS} يوم</div>
        )}
      </div>

      {/* WhatsApp texts */}
      <div className="border-t border-theme/50 pt-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted font-bold">رسايل الواتساب</span>
          {!editingTexts && (
            <button
              onClick={() => {
                setReminderText(settings.waReminderTemplate || DEFAULT_REMINDER_TEMPLATE);
                setReceiptText(settings.waReceiptTemplate || DEFAULT_RECEIPT_TEMPLATE);
                setEditingTexts(true);
              }}
              className="text-[11px] text-primary underline font-bold"
            >
              تعديل
            </button>
          )}
        </div>
        {editingTexts ? (
          <div className="space-y-2">
            <label className="text-[11px] text-muted block">تذكير بالدفع</label>
            <textarea
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              rows={5}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            <div className="text-[10px] text-muted" dir="rtl">المتغيرات: {REMINDER_VARIABLES.join(' ')}</div>
            <label className="text-[11px] text-muted block pt-1">إيصال بعد الدفع</label>
            <textarea
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
              rows={5}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            <div className="text-[10px] text-muted" dir="rtl">المتغيرات: {RECEIPT_VARIABLES.join(' ')}</div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveTexts} className="w-1/3 btn-primary py-2 rounded-md text-xs font-bold">حفظ</button>
              <button
                onClick={() => {
                  setReminderText(DEFAULT_REMINDER_TEMPLATE);
                  setReceiptText(DEFAULT_RECEIPT_TEMPLATE);
                }}
                className="w-1/3 input-bg py-2 rounded-md text-xs border border-theme"
              >
                النص الأصلي
              </button>
              <button onClick={() => setEditingTexts(false)} className="w-1/3 input-bg py-2 rounded-md text-xs border border-theme">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted leading-relaxed">
            التذكير مش بيكتب سعر اللاعب. بيكتب الاسم وتاريخ الانتهاء أو "خلصت حصصك" والحصص الزيادة.
          </div>
        )}
      </div>
    </div>
  );
};
