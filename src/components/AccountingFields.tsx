import React from 'react';
import type { EndMode } from '../types';
import { DEFAULT_PLACE } from '../lib/subscription';

/** "بتخلص بالحصص" / "بتخلص بالشهر" choice for packages (single session has none). */
export const EndModePicker: React.FC<{ value: EndMode; onChange: (v: EndMode) => void }> = ({ value, onChange }) => (
  <div>
    <label className="text-xs text-muted font-bold block mb-1">الاشتراك بيخلص إمتى؟</label>
    <div className="grid grid-cols-2 gap-2">
      {([
        ['sessions', 'بتخلص بالحصص', 'حتى لو الشهر عدّى'],
        ['month', 'بتخلص بالشهر', 'حتى لو فاضل حصص'],
      ] as const).map(([mode, title, hint]) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-md px-2 py-2 text-xs font-bold border transition-all ${
            value === mode
              ? 'border-orange-500 bg-orange-500/15 text-orange-400'
              : 'border-theme input-bg text-muted'
          }`}
        >
          {title}
          <span className="block text-[9px] font-normal opacity-80">{hint}</span>
        </button>
      ))}
    </div>
  </div>
);

/** Gym / place money with an always-visible label. Pre-filled with a suggestion, editable. */
export const GymCostField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
  touched: boolean;
  compact?: boolean;
}> = ({ value, onChange, onReset, touched, compact }) => (
  <div>
    <label className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted font-bold flex justify-between items-center mb-1`}>
      <span>للجيم / المكان (ج)</span>
      {touched && (
        <button type="button" onClick={onReset} className="text-[9px] text-orange-400 underline font-normal">
          الرقم المقترح
        </button>
      )}
    </label>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`w-full input-bg rounded-md ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'} border border-theme text-danger font-bold`}
    />
  </div>
);

/** Optional place (default "الجيم") that remembers places typed before. */
export const PlaceField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  listId: string;
  compact?: boolean;
}> = ({ value, onChange, suggestions, listId, compact }) => (
  <div>
    <label className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted font-bold block mb-1`}>المكان (اختياري)</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      list={listId}
      placeholder={DEFAULT_PLACE}
      className={`w-full input-bg rounded-md ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'} border border-theme`}
    />
    <datalist id={listId}>
      {suggestions.map(p => (
        <option key={p} value={p} />
      ))}
    </datalist>
  </div>
);
