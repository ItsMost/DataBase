import React from 'react';
import { useProfileSection, type ProfileSectionProps } from '../hooks/useProfileSection';
import { TreasuryAndBackup } from './profile/TreasuryAndBackup';
import { ExpensesAndChart } from './profile/ExpensesAndChart';
import { ProfitHeatmap } from './profile/ProfitHeatmap';
import { MonthlyReports } from './profile/MonthlyReports';
import { DailyReports } from './profile/DailyReports';
import { WalletReport } from './profile/WalletReport';
import { DayDetailsModal } from './profile/DayDetailsModal';
import { AdvancedSettings } from './profile/AdvancedSettings';

export type { ProfileSectionProps };

export const ProfileSection: React.FC<ProfileSectionProps> = (props) => {
  const vm = useProfileSection(props);
  const { subTab, setSubTab } = vm;

  return (
    <div className="space-y-6">
      <TreasuryAndBackup vm={vm} />
      <ExpensesAndChart vm={vm} />
      <ProfitHeatmap vm={vm} />
      {/* 7. Comprehensive Monthly & Daily Financial Reports sub-tabs */}
      <div className="card-bg rounded-lg p-4 mb-6 border-t-2 border-theme relative">
        <h2 className="text-lg font-bold text-primary mb-4 flex items-center glow-text">
          <svg className="w-5 h-5 ml-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          التقارير المالية والتحليل (History)
        </h2>
        <div className="flex border-b border-theme mb-4">
          <button
            onClick={() => setSubTab('monthly')}
            className={`w-1/3 py-2 text-center text-xs sm:text-sm font-bold transition-all rounded-t-lg ${
              subTab === 'monthly' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            بالشهر
          </button>
          <button
            onClick={() => setSubTab('daily')}
            className={`w-1/3 py-2 text-center text-xs sm:text-sm font-bold transition-all rounded-t-lg ${
              subTab === 'daily' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            باليوم
          </button>
          <button
            onClick={() => setSubTab('wallet')}
            className={`w-1/3 py-2 text-center text-xs sm:text-sm font-bold transition-all rounded-t-lg ${
              subTab === 'wallet' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            💼 المحفظة
          </button>
        </div>

        <MonthlyReports vm={vm} />
        <DailyReports vm={vm} />
        <WalletReport vm={vm} />

      </div>

      <DayDetailsModal vm={vm} />
      <AdvancedSettings vm={vm} />

    </div>
  );
};
