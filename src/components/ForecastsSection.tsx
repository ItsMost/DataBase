import React from 'react';
import type { Player, ExpectedAttendee } from '../types';

interface ForecastsSectionProps {
  players: Player[];
  expectedAttendees: ExpectedAttendee[];
  getTodayDate: () => string;
}

export const ForecastsSection: React.FC<ForecastsSectionProps> = ({
  players,
  expectedAttendees,
  getTodayDate,
}) => {
  // Helper for checking subscription expiration
  const checkExpiration = (player: Player) => {
    if (!player.startDate || !player.subType || player.subType === 'حصة واحدة') {
      return { isExpired: true, days: 0, endDateStr: '-' };
    }
    const start = new Date(player.startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const today = new Date(getTodayDate());
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = diffDays < 0;
    const endDateStr = end.toLocaleDateString('en-GB');

    return {
      isExpired,
      days: Math.abs(diffDays),
      endDateStr,
      endDateObj: end,
    };
  };

  // --- Historical data compiled to find daily averages ---
  const dailySessionRevenues: { [date: string]: number } = {};
  const dailySessionCosts: { [date: string]: number } = {};
  const dailySessionCounts: { [date: string]: number } = {};

  players.forEach(p => {
    if (!p.isSystem) {
      p.history?.forEach(h => {
        if (h.subType === 'حصة واحدة') {
          dailySessionRevenues[h.date] = (dailySessionRevenues[h.date] || 0) + (h.paid || 0);
          dailySessionCosts[h.date] = (dailySessionCosts[h.date] || 0) + (h.cost || 0);
          dailySessionCounts[h.date] = (dailySessionCounts[h.date] || 0) + 1;
        }
      });

      // Calculate gym cost additions from expired or walk-in attendees
      p.attendance?.forEach(attDate => {
        let isMonthly = false;
        let hasPaidDailyToday = false;
        if (p.history) {
          hasPaidDailyToday = p.history.some(h => h.date === attDate && h.subType === 'حصة واحدة');
          const pastHistories = p.history
            .filter(h => h.date <= attDate)
            .sort((a, b) => b.date.localeCompare(a.date));
          if (pastHistories.length > 0 && pastHistories[0].subType !== 'حصة واحدة') {
            const start = new Date(pastHistories[0].date);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            const att = new Date(attDate);
            if (att <= end) {
              isMonthly = true;
            }
          }
        }
        if (!isMonthly && !hasPaidDailyToday) {
          dailySessionCosts[attDate] = (dailySessionCosts[attDate] || 0) + 60;
        }
      });
    }
  });

  const dailyDates = Object.keys(dailySessionRevenues);
  const allHistoricalDates = [...new Set(dailyDates)].sort();

  // Compute daily averages over the last 14 days
  const last14Dates = allHistoricalDates.slice(-14);
  const activeDaysCount = last14Dates.length || 1;

  let totalHistDailyRev = 0;
  let totalHistDailyCost = 0;
  let totalHistDailyCount = 0;

  last14Dates.forEach(d => {
    totalHistDailyRev += dailySessionRevenues[d] || 0;
    totalHistDailyCost += dailySessionCosts[d] || 0;
    totalHistDailyCount += dailySessionCounts[d] || 0;
  });

  const avgDailySessionRevenue = totalHistDailyRev / activeDaysCount;
  const avgDailySessionCost = totalHistDailyCost / activeDaysCount;
  const avgDailySessionCount = totalHistDailyCount / activeDaysCount;

  // --- TODAY'S PROJECTION (اليوم) ---
  const attendedToday = players.filter(
    p => !p.isSystem && !p.isDeleted && p.attendance && p.attendance.includes(getTodayDate())
  );
  const attendedTodayCount = attendedToday.length;

  let actualRevToday = 0;
  let actualCostToday = 0;

  players.forEach(p => {
    if (!p.isSystem) {
      p.history?.forEach(h => {
        if (h.date === getTodayDate()) {
          actualRevToday += h.paid || 0;
          actualCostToday += h.cost || 0;
        }
      });
    }
  });

  let expectedRevToday = 0;
  let expectedCostToday = 0;
  const activeExpected = expectedAttendees.filter(att => !att.isDeleted);
  const expectedAttendeesCount = activeExpected.length;

  activeExpected.forEach(att => {
    expectedRevToday += att.paid || 0;
    if (att.subType === 'حصة واحدة' || att.subType === 'حضور فقط (مشترك شهرياً)' || att.subType === 'حضور فقط') {
      expectedCostToday += 60;
    } else {
      const monthlyCost =
        att.subType === '8 حصص' ? 480 :
        att.subType === '10 حصص' ? 600 :
        att.subType === '12 حصة' ? 720 :
        att.subType === '16 حصة' ? 960 : 1200;
      expectedCostToday += monthlyCost;
    }
  });

  const todayRevForecast = actualRevToday + expectedRevToday;
  const todayCostForecast = actualCostToday + expectedCostToday;
  const todayProfitForecast = todayRevForecast - todayCostForecast;
  const todayPeopleForecast = attendedTodayCount + expectedAttendeesCount;

  // --- WEEKLY PROJECTION (الأسبوع) ---
  const expiringPlayersNext7 = players.filter(p => {
    if (p.isSystem || p.isDeleted || !p.subType || p.subType === 'حصة واحدة') return false;
    const exp = checkExpiration(p);
    if (exp.isExpired) {
      return exp.days <= 14; // Expired but within last 14 days
    } else {
      return exp.days <= 7; // Expiring in next 7 days
    }
  });

  let expectedWeeklyRenewalRevenue = 0;
  let expectedWeeklyRenewalCost = 0;
  expiringPlayersNext7.forEach(p => {
    expectedWeeklyRenewalRevenue += p.paid || 0;
    expectedWeeklyRenewalCost += p.cost || 0;
  });

  const weeklyDailySessionsRev = avgDailySessionRevenue * 7;
  const weeklyDailySessionsCost = avgDailySessionCost * 7;

  const weeklyRevForecast = expectedWeeklyRenewalRevenue + weeklyDailySessionsRev;
  const weeklyCostForecast = expectedWeeklyRenewalCost + weeklyDailySessionsCost;
  const weeklyProfitForecast = weeklyRevForecast - weeklyCostForecast;

  const activeMonthlyMembersCount = players.filter(
    p => !p.isSystem && !p.isDeleted && p.subType && p.subType !== 'حصة واحدة' && !checkExpiration(p).isExpired
  ).length;
  const weeklyPeopleForecast = Math.round(activeMonthlyMembersCount * 1.5 + avgDailySessionCount * 7);

  // --- MONTHLY PROJECTION (الشهر) ---
  const activeMonthlyMembers = players.filter(p => {
    if (p.isSystem || p.isDeleted || !p.subType || p.subType === 'حصة واحدة') return false;
    const exp = checkExpiration(p);
    // Include if not expired OR expired but within last 14 days
    return !exp.isExpired || exp.days <= 14;
  });

  let expectedMonthlyRenewalRevenue = 0;
  let expectedMonthlyRenewalCost = 0;
  activeMonthlyMembers.forEach(p => {
    expectedMonthlyRenewalRevenue += p.paid || 0;
    expectedMonthlyRenewalCost += p.cost || 0;
  });

  const monthlyDailySessionsRev = avgDailySessionRevenue * 30;
  const monthlyDailySessionsCost = avgDailySessionCost * 30;

  const monthlyRevForecast = expectedMonthlyRenewalRevenue + monthlyDailySessionsRev;
  const monthlyCostForecast = expectedMonthlyRenewalCost + monthlyDailySessionsCost;
  const monthlyProfitForecast = monthlyRevForecast - monthlyCostForecast;

  const monthlyPeopleForecast = Math.round(activeMonthlyMembers.length * 6 + avgDailySessionCount * 30);

  // Target footfall calculation today
  const targetAttendanceProgress = todayPeopleForecast > 0 ? (attendedTodayCount / todayPeopleForecast) * 100 : 0;

  // Split renewing players into Overdue (expired <= 14 days) and Upcoming (expires <= 7 days)
  const overduePlayers = expiringPlayersNext7.filter(p => checkExpiration(p).isExpired);
  const upcomingRenewals = expiringPlayersNext7.filter(p => !checkExpiration(p).isExpired);

  const overdueRevenue = overduePlayers.reduce((sum, p) => sum + (p.paid || 0), 0);
  const upcomingRevenue = upcomingRenewals.reduce((sum, p) => sum + (p.paid || 0), 0);

  return (
    <div className="space-y-6 px-4 pb-8">
      {/* 1. Header description */}
      <div className="card-bg rounded-lg p-5 border-t-2 border-purple-500 relative overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.15)]">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl opacity-50"></div>
        <h2 className="text-lg font-bold text-purple-400 mb-2 flex items-center gap-1.5 glow-text pr-2">
          🔮 التحليلات والتنبؤات التوقعية
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          يقوم النظام بتحليل نشاط الاشتراكات، وجداول الحضور المتوقعة، والبيانات التاريخية لتقديم رؤية ذكية حول الإيرادات وصافي الأرباح المتوقع تحصيلها اليوم، وخلال الأسبوع والشهر.
        </p>
      </div>

      {/* 2. Forecasts Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Day Forecast */}
        <div className="card-bg rounded-lg p-4 border border-purple-500/20 shadow-sm relative">
          <div className="flex justify-between items-center mb-3 border-b border-theme pb-2">
            <span className="text-sm font-bold text-purple-400">توقعات اليوم الحالي 🎯</span>
            <span className="text-[10px] text-muted bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
              {todayPeopleForecast} حضور متوقع
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/20 p-2 rounded border border-theme/40">
              <span className="text-[9px] text-muted block mb-1">الإيرادات المتوقعة</span>
              <span className="text-success font-bold text-sm">{Math.round(todayRevForecast)} ج</span>
            </div>
            <div className="bg-black/20 p-2 rounded border border-theme/40">
              <span className="text-[9px] text-muted block mb-1">تكلفة الجيم المتوقعة</span>
              <span className="text-danger font-bold text-sm">{Math.round(todayCostForecast)} ج</span>
            </div>
            <div className="bg-purple-950/20 p-2 rounded border border-purple-500/30 shadow-[inset_0_0_8px_rgba(168,85,247,0.1)]">
              <span className="text-[9px] text-purple-300 block mb-1">صافي الربح المتوقع</span>
              <span className="text-purple-400 font-bold text-sm glow-text">{Math.round(todayProfitForecast)} ج</span>
            </div>
          </div>

          {/* Progress bar today */}
          <div className="mt-3 pt-2 border-t border-theme/50">
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>الحضور الفعلي اليوم: <b>{attendedTodayCount}</b> من <b>{todayPeopleForecast}</b></span>
              <span className="font-semibold text-success">{Math.round(targetAttendanceProgress)}%</span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-theme/30">
              <div
                className="h-1.5 bg-gradient-to-l from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${targetAttendanceProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Week Forecast */}
        <div className="card-bg rounded-lg p-4 border border-blue-500/20 shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b border-theme pb-2">
            <span className="text-sm font-bold text-blue-400">توقعات الـ 7 أيام القادمة (أسبوع) 📅</span>
            <span className="text-[10px] text-muted bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
              ~{weeklyPeopleForecast} حضور متوقع
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/20 p-2 rounded border border-theme/40">
              <span className="text-[9px] text-muted block mb-1">الإيرادات المتوقعة</span>
              <span className="text-success font-bold text-sm">{Math.round(weeklyRevForecast)} ج</span>
            </div>
            <div className="bg-black/20 p-2 rounded border border-theme/40">
              <span className="text-[9px] text-muted block mb-1">تكلفة الجيم المتوقعة</span>
              <span className="text-danger font-bold text-sm">{Math.round(weeklyCostForecast)} ج</span>
            </div>
            <div className="bg-blue-950/20 p-2 rounded border border-blue-500/30 shadow-[inset_0_0_8px_rgba(59,130,246,0.1)]">
              <span className="text-[9px] text-blue-300 block mb-1">صافي الربح المتوقع</span>
              <span className="text-blue-400 font-bold text-sm glow-text">{Math.round(weeklyProfitForecast)} ج</span>
            </div>
          </div>
        </div>

        {/* Month Forecast */}
        <div className="card-bg rounded-lg p-4 border border-emerald-500/20 shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b border-theme pb-2">
            <span className="text-sm font-bold text-emerald-400">توقعات الـ 30 يوماً القادمة (شهر) 🌐</span>
            <span className="text-[10px] text-muted bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
              ~{monthlyPeopleForecast} حضور متوقع
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/20 p-2 rounded border border-theme/40">
              <span className="text-[9px] text-muted block mb-1">الإيرادات المتوقعة</span>
              <span className="text-success font-bold text-sm">{Math.round(monthlyRevForecast)} ج</span>
            </div>
            <div className="bg-black/20 p-2 rounded border border-theme/40">
              <span className="text-[9px] text-muted block mb-1">تكلفة الجيم المتوقعة</span>
              <span className="text-danger font-bold text-sm">{Math.round(monthlyCostForecast)} ج</span>
            </div>
            <div className="bg-emerald-950/20 p-2 rounded border border-emerald-500/30 shadow-[inset_0_0_8px_rgba(16,185,129,0.1)]">
              <span className="text-[9px] text-emerald-300 block mb-1">صافي الربح المتوقع</span>
              <span className="text-emerald-400 font-bold text-sm glow-text">{Math.round(monthlyProfitForecast)} ج</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Upcoming Renewals */}
      <div className="card-bg rounded-lg p-5 border-t-2 border-amber-500 relative space-y-4">
        <h3 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-1.5 glow-text pr-2 border-b border-theme/30 pb-2">
          💰 التجديدات والتدفقات المالية المنتظرة
        </h3>
        
        <div className="max-h-96 overflow-y-auto pr-1 space-y-4">
          {/* 3.1 Overdue Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-red-950/20 border border-red-500/20 px-3 py-2 rounded-lg">
              <span className="text-xs font-bold text-red-400">🚨 لاعبون متأخرون عن الدفع (انتهى اشتراكهم خلال آخر 14 يوم)</span>
              <span className="bg-red-950/40 text-red-300 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                إجمالي المتوقع: {overdueRevenue} ج.م
              </span>
            </div>
            <div className="space-y-1.5 pr-1">
              {overduePlayers.length === 0 ? (
                <div className="text-[10px] text-muted text-center py-4 border border-dashed border-theme/40 rounded bg-black/5">
                  لا يوجد متأخرون عن الدفع حالياً.
                </div>
              ) : (
                overduePlayers.map(p => {
                  const exp = checkExpiration(p);
                  const renewAmount = p.paid || 0;
                  return (
                    <div
                      key={p.id}
                      className="input-bg rounded p-2.5 flex justify-between items-center border border-theme/50 hover:border-red-500/20 transition-all text-xs animate-fadeIn"
                    >
                      <div className="text-right">
                        <span className="font-bold text-main block text-xs">[#{p.number}] {p.name}</span>
                        <span className="text-muted block text-[10px] mt-0.5">الجروب: {p.sport || 'العام'}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-red-400 font-bold block text-xs">+{renewAmount} ج متوقعة</span>
                        <span className="text-[10px] block mt-0.5 text-danger font-semibold">
                          منتهي منذ {exp.days} أيام
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3.2 Upcoming Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
              <span className="text-xs font-bold text-amber-400">📅 اشتراكات تنتهي قريباً (خلال 7 أيام قادمة)</span>
              <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                إجمالي المتوقع: {upcomingRevenue} ج.م
              </span>
            </div>
            <div className="space-y-1.5 pr-1">
              {upcomingRenewals.length === 0 ? (
                <div className="text-[10px] text-muted text-center py-4 border border-dashed border-theme/40 rounded bg-black/5">
                  لا توجد اشتراكات ستنتهي خلال 7 أيام قادمة.
                </div>
              ) : (
                upcomingRenewals.map(p => {
                  const exp = checkExpiration(p);
                  const renewAmount = p.paid || 0;
                  return (
                    <div
                      key={p.id}
                      className="input-bg rounded p-2.5 flex justify-between items-center border border-theme/50 hover:border-amber-500/20 transition-all text-xs animate-fadeIn"
                    >
                      <div className="text-right">
                        <span className="font-bold text-main block text-xs">[#{p.number}] {p.name}</span>
                        <span className="text-muted block text-[10px] mt-0.5">الجروب: {p.sport || 'العام'}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-amber-400 font-bold block text-xs">+{renewAmount} ج متوقعة</span>
                        <span className="text-[10px] block mt-0.5 text-success">
                          ينتهي خلال {exp.days} أيام
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
