import React, { useState } from 'react';
import type { Player } from '../types';

interface DuplicateNamesAlertProps {
  groups: Player[][];
  /** Opens the normal delete confirmation for that player (nothing is deleted without confirming). */
  onDelete: (playerId: string) => void;
}

export const DuplicateNamesAlert: React.FC<DuplicateNamesAlertProps> = ({ groups, onDelete }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center text-right"
      >
        <span className="text-amber-400 font-black text-sm">
          ⚠️ فيه أسماء مكررة ({groups.length})
        </span>
        <span className="text-amber-400 text-xs font-bold">{open ? 'إخفاء ▲' : 'عرض ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-muted font-bold">
            التطبيق مش هيمسح أي حاجة لوحده. راجع كل اسم وقرر انت تمسح أنهي نسخة.
          </p>
          {groups.map((list, gi) => (
            <div key={gi} className="input-bg rounded-lg border border-theme p-2 space-y-2">
              <div className="text-primary font-black text-sm">{list[0].name}</div>
              {list.map(p => (
                <div
                  key={p.id}
                  className="flex justify-between items-center gap-2 border-t border-theme/40 pt-2 text-[11px]"
                >
                  <div className="text-main font-bold leading-relaxed">
                    <div>#{p.number || '-'} · {p.sport || '-'} · {p.club || '-'}</div>
                    <div className="text-muted">
                      موبايل: {p.phone || '-'} · مواليد: {p.birthYear || '-'} · مدفوعات: {p.history?.length || 0} · حضور: {p.attendance?.length || 0}
                    </div>
                    <div className="text-muted">
                      آخر تعديل: {p.last_updated ? new Date(p.last_updated).toLocaleDateString('en-GB') : '-'}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-danger bg-danger/10 hover:bg-danger hover:text-white border border-danger/20 rounded px-2 py-1 text-[10px] font-black whitespace-nowrap"
                  >
                    مسح 🗑️
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
