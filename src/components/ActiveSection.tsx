import React from 'react';
import { useActiveSection, type ActiveSectionProps } from '../hooks/useActiveSection';
import { SubscriptionAlerts } from './subscriptions/SubscriptionAlerts';
import { ExpectedTodayPanel } from './subscriptions/ExpectedTodayPanel';
import { PaymentForm } from './subscriptions/PaymentForm';
import { TodayAttendance } from './subscriptions/TodayAttendance';
import { MonthlySubscriptions } from './subscriptions/MonthlySubscriptions';
import { DailyArchive } from './subscriptions/DailyArchive';

export type { ActiveSectionProps };

export const ActiveSection: React.FC<ActiveSectionProps> = (props) => {
  const vm = useActiveSection(props);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Alerts, Expected, Payment Forms (col-span-5) */}
      <div className="lg:col-span-5 space-y-6 lg:order-1">
      <SubscriptionAlerts vm={vm} />
      <ExpectedTodayPanel vm={vm} />
      <PaymentForm vm={vm} />

      </div>

      {/* Right Column: Attendance list, Monthly subs, Collapsible Archive (col-span-7) */}
      <div className="lg:col-span-7 space-y-6 lg:order-2">
        <TodayAttendance vm={vm} />
      <MonthlySubscriptions vm={vm} />
      <DailyArchive vm={vm} />


      </div>
    </div>
  );
};
