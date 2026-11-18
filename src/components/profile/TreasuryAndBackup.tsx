/**
 * All-time treasury (revenue, gym/place share, other expenses) + backup/export.
 */
import React from 'react';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const TreasuryAndBackup: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { onExportCSV, onExportJSON, financials } = vm;
  return (
    <>
      {/* Grid 1: Treasury & Backup / Scan Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fadeIn">
        {/* 1. Historical Treasury Stats */}
        <div className="card-bg rounded-lg p-5 border-t-2 border-primary relative overflow-hidden h-full">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary-glow rounded-full blur-3xl opacity-50"></div>
          <h2 className="text-lg font-bold text-primary mb-4 flex items-center glow-text relative z-10">
            👑 إجمالي الخزنة (كل الأوقات)
          </h2>
          <div className="grid grid-cols-2 gap-3 text-center relative z-10">
            <div className="input-bg p-3 rounded-lg border border-theme">
              <div className="text-[10px] text-muted mb-1">إجمالي الإيرادات</div>
              <div className="text-success font-bold text-base">{financials.allTimeRev} ج.م</div>
            </div>
            <div className="input-bg p-3 rounded-lg border border-theme">
              <div className="text-[10px] text-muted mb-1">نصيب الجيم / المكان</div>
              <div className="text-danger font-bold text-base">{financials.allTimeGymCost} ج.م</div>
            </div>
            <div className="col-span-2 input-bg p-3 rounded-lg border border-theme">
              <div className="text-[10px] text-muted mb-1">مصروفات تانية (مواصلات، أدوات، إيجار...)</div>
              <div className="text-orange-400 font-bold text-base">{financials.allTimeExtExp} ج.م</div>
            </div>
            <div className="col-span-2 bg-primary/10 p-4 rounded-lg border border-primary relative overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.2)] mt-1">
              <div className="text-xs text-primary-light mb-1 font-bold">صافي الربح التاريخي</div>
              <div className="text-primary-light font-bold text-3xl glow-text tracking-wider">
                {financials.netProfit} ج.م
              </div>
            </div>
          </div>
        </div>

        {/* Backup & Deep Scan Tools Column */}
        <div className="space-y-6">
          {/* 2. Backup & Excel Tools */}
          <div className="card-bg rounded-lg p-5 border-t-2 border-blue-500 relative">
            <h2 className="text-lg font-bold text-blue-500 mb-4 flex items-center">
              💾 النسخ الاحتياطي وتصدير الداتا
            </h2>
            <p className="text-xs text-main mb-4 leading-relaxed">
              فيه نسخة احتياطية أوتوماتيك كل أسبوع على السحابة (آخر 8 نسخ). وتقدر كمان تنزّل نسخة بنفسك من هنا.
            </p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={onExportJSON}
                className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/50 py-2 rounded-lg font-bold hover:bg-blue-500 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)]"
              >
                نسخ (Export)
              </button>
            </div>
            <button
              onClick={onExportCSV}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 py-3 rounded-lg font-bold hover:bg-emerald-500 hover:text-white transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              تصدير الداتا شيت إكسيل (Excel CSV)
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
