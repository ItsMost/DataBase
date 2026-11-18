import React from 'react';

export const ExtrasBalance: React.FC<{ count: number; gym: number; onPay: () => void }> = ({ count, gym, onPay }) => (
  <div className="mt-3 flex justify-between items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
    <div className="text-[11px] font-bold text-amber-400 leading-relaxed">
      <div>حضر {count} حصص زيادة</div>
      <div>دفعت للجيم بداله: {gym} ج</div>
    </div>
    <button
      onClick={onPay}
      className="bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap active:scale-95"
    >
      دفع 💰
    </button>
  </div>
);
