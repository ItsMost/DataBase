import React, { useState } from 'react';
import type { Player } from '../../types';
import { formatDate } from '../../lib/dates';

/**
 * Trash: players moved here by "مسح" are hidden everywhere but never erased,
 * so a phone that was offline can't bring them back by mistake, and they can be restored.
 * Their old payments stay counted in the reports.
 */
export const TrashBin: React.FC<{ players: Player[]; onRestore: (playerId: string) => Promise<void> }> = ({ players, onRestore }) => {
  const [open, setOpen] = useState(false);
  const deleted = players
    .filter(p => p.isDeleted && !p.isSystem)
    .sort((a, b) => (b.deletedAt || b.last_updated || 0) - (a.deletedAt || a.last_updated || 0));

  return (
    <div className="input-bg rounded-lg border border-theme p-4 mb-4">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex justify-between items-center">
        <span className="font-black text-main">🗑️ سلة المحذوفات ({deleted.length})</span>
        <span className="text-xs text-muted font-bold">{open ? 'إخفاء ▲' : 'عرض ▼'}</span>
      </button>
      <p className="text-[11px] text-muted mt-1 leading-relaxed">
        اللاعب الممسوح بيختفي من القوايم بس، وفلوسه القديمة بتفضل محسوبة. تقدر ترجّعه في أي وقت.
      </p>
      {open && (
        <div className="mt-3 max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {deleted.length === 0 ? (
            <div className="text-[11px] text-muted text-center py-2">السلة فاضية ✅</div>
          ) : (
            deleted.map(p => {
              const when = p.deletedAt || p.last_updated;
              return (
                <div key={p.id} className="card-bg rounded p-2 flex justify-between items-center border border-theme text-xs gap-2">
                  <div className="text-right">
                    <span className="font-bold text-main block">[#{p.number || '---'}] {p.name}</span>
                    <span className="text-muted text-[10px]">
                      {p.sport || '-'}
                      {when ? ` · اتمسح ${formatDate(new Date(when).toISOString().slice(0, 10))}` : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => onRestore(p.id)}
                    className="bg-success/20 text-success border border-success/40 px-2 py-1.5 rounded font-bold whitespace-nowrap"
                  >
                    استرجاع ♻️
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
