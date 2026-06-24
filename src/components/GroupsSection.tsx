import React, { useState } from 'react';
import type { Player, HistoryEntry } from '../types';

interface GroupsSectionProps {
  players: Player[];
  groupsConfig: HistoryEntry[];
  onSaveGroupConfig: (name: string, focusType: 'focus' | 'presence') => Promise<void>;
  onDeleteGroupConfig: (name: string) => Promise<void>;
}

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  players,
  groupsConfig,
  onSaveGroupConfig,
  onDeleteGroupConfig,
}) => {
  // Month names in Arabic
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  // 1. Generate unique month keys from data
  const uniqueMonths = new Set<string>();
  uniqueMonths.add(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  players.forEach(p => {
    p.history?.forEach(h => {
      if (h.date) {
        const [y, m] = h.date.split('-');
        uniqueMonths.add(`${y}-${m}`);
      }
    });
    p.attendance?.forEach(attDate => {
      if (attDate) {
        const [y, m] = attDate.split('-');
        uniqueMonths.add(`${y}-${m}`);
      }
    });
  });
  const sortedMonths = Array.from(uniqueMonths).sort().reverse();

  // States
  const [monthFilter, setMonthFilter] = useState(() => sortedMonths[0]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showDailyPlayers, setShowDailyPlayers] = useState(false);
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'focus' | 'presence'>('all');

  // Add group form states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFocus, setNewGroupFocus] = useState<'focus' | 'presence'>('focus');
  const [isAdding, setIsAdding] = useState(false);

  const [filterYear, filterMonth] = monthFilter.split('-').map(x => parseInt(x, 10));
  const currentMonth = filterMonth - 1;
  const currentYear = filterYear;

  // 2. Helper to get focus level for a group name
  const getFocusType = (name: string): 'focus' | 'presence' => {
    const config = groupsConfig.find(h => h.desc === name);
    return (config?.subType as 'focus' | 'presence') || 'presence';
  };

  // 3. Compute groups dynamically
  const defaultGroups = ['جروب A', 'جروب B', 'العام'];
  const currentGroups = players.filter(p => !p.isSystem && !p.isDeleted).map(p => p.sport || 'العام');
  const configuredGroups = groupsConfig.map(h => h.desc);
  const allGroups = [...new Set([...defaultGroups, ...currentGroups, ...configuredGroups])];

  // 4. Compute financial and attendance statistics per group
  const groupsStats: {
    [groupName: string]: { revenue: number; cost: number; profit: number; count: number; totalAttendance: number; membersCount: number };
  } = {};

  const groupDetails: {
    [groupName: string]: {
      dailyPlayers: Array<{ name: string; paidAmount: number; attendanceCount: number }>;
      monthlyPlayers: Array<{ name: string; paymentCount: number; paidAmount: number; attendanceCount: number }>;
      maxAttendance: number; // To find top attendee
    }
  } = {};

  // Initialize statistics for all groups
  allGroups.forEach(g => {
    groupsStats[g] = { revenue: 0, cost: 0, profit: 0, count: 0, totalAttendance: 0, membersCount: 0 };
    groupDetails[g] = { dailyPlayers: [], monthlyPlayers: [], maxAttendance: 0 };
  });

  // Calculate stats from players
  players
    .filter(p => !p.isSystem && !p.isDeleted)
    .forEach(p => {
      const groupName = p.sport || 'العام';
      
      if (!groupsStats[groupName]) {
        groupsStats[groupName] = { revenue: 0, cost: 0, profit: 0, count: 0, totalAttendance: 0, membersCount: 0 };
      }
      if (!groupDetails[groupName]) {
        groupDetails[groupName] = { dailyPlayers: [], monthlyPlayers: [], maxAttendance: 0 };
      }

      groupsStats[groupName].membersCount++;

      // Filter attendance in selected month
      const currentMonthAttendances = p.attendance
        ? p.attendance.filter(attDate => {
            const parts = attDate.split('-');
            if (parts.length < 2) return false;
            return parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === filterMonth;
          })
        : [];
      const attCount = currentMonthAttendances.length;
      groupsStats[groupName].totalAttendance += attCount;

      // Filter history in selected month
      const currentMonthHistory = p.history
        ? p.history.filter(h => {
            const parts = h.date.split('-');
            if (parts.length < 2) return false;
            return parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === filterMonth;
          })
        : [];

      // Add financial totals
      currentMonthHistory.forEach(h => {
        groupsStats[groupName].revenue += h.paid || 0;
        groupsStats[groupName].cost += h.cost || 0;
        groupsStats[groupName].profit += (h.paid || 0) - (h.cost || 0);
        groupsStats[groupName].count++;
      });

      // Daily session payments gym cost additions (which are not in history but exist in attendance)
      p.attendance?.forEach(attDate => {
        const parts = attDate.split('-');
        if (parts.length < 2) return;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (y === currentYear && m === filterMonth) {
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
            groupsStats[groupName].cost += 60;
            groupsStats[groupName].profit -= 60;
          }
        }
      });

      // Categorize player for roster details
      const hasDailyPayment = currentMonthHistory.some(h => h.subType === 'حصة واحدة');
      const hasMonthlyPayment = currentMonthHistory.some(h => h.subType && h.subType !== 'حصة واحدة');
      
      const isMonthlyPlayer = hasMonthlyPayment || (p.subType && p.subType !== 'حصة واحدة' && !hasDailyPayment);

      const paidAmount = currentMonthHistory.reduce((sum, h) => sum + (h.paid || 0), 0);

      if (isMonthlyPlayer) {
        const paymentCount = currentMonthHistory.filter(h => h.subType && h.subType !== 'حصة واحدة').length;
        if (paymentCount > 0 || attCount > 0) {
          groupDetails[groupName].monthlyPlayers.push({
            name: p.name,
            paymentCount,
            paidAmount,
            attendanceCount: attCount,
          });
          if (attCount > groupDetails[groupName].maxAttendance) {
            groupDetails[groupName].maxAttendance = attCount;
          }
        }
      } else {
        if (hasDailyPayment || attCount > 0) {
          groupDetails[groupName].dailyPlayers.push({
            name: p.name,
            paidAmount,
            attendanceCount: attCount,
          });
          if (attCount > groupDetails[groupName].maxAttendance) {
            groupDetails[groupName].maxAttendance = attCount;
          }
        }
      }
    });

  // Sort detailed players by attendance descending
  Object.keys(groupDetails).forEach(gName => {
    groupDetails[gName].dailyPlayers.sort((a, b) => b.attendanceCount - a.attendanceCount);
    groupDetails[gName].monthlyPlayers.sort((a, b) => b.attendanceCount - a.attendanceCount);
  });

  // Filter groups according to classification tab
  const filteredGroups = allGroups.filter(gName => {
    const focusType = getFocusType(gName);
    if (classificationFilter === 'all') return true;
    return focusType === classificationFilter;
  });

  const handleAddGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    await onSaveGroupConfig(newGroupName.trim(), newGroupFocus);
    setNewGroupName('');
    setIsAdding(false);
  };

  const handleToggleFocus = async (groupName: string, currentFocus: 'focus' | 'presence') => {
    const newFocus = currentFocus === 'focus' ? 'presence' : 'focus';
    await onSaveGroupConfig(groupName, newFocus);
  };

  // CSV Export for Group
  const handleExportGroupCSV = (groupName: string) => {
    const details = groupDetails[groupName];
    if (!details) return;

    let csvContent = '\uFEFF'; // Excel UTF-8 BOM to support Arabic
    csvContent += "الاسم,نوع الحضور,عدد التجديدات هذا الشهر,عدد أيام الحضور هذا الشهر\n";

    details.monthlyPlayers.forEach(p => {
      csvContent += `${p.name.replace(/,/g, ' ')},اشتراك شهري,${p.paymentCount},${p.attendanceCount}\n`;
    });

    details.dailyPlayers.forEach(p => {
      csvContent += `${p.name.replace(/,/g, ' ')},بالحصة,-,${p.attendanceCount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_لاعبين_جروب_${groupName}_${monthFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Add Group Button */}
      <div className="card-bg rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4 border border-theme select-none">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-primary flex items-center gap-1.5 glow-text">
            <span>👥 لوحة التحكم وإدارة الجروبات</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted whitespace-nowrap">تصفية الشهر:</span>
            <select
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setSelectedGroup(null);
                setShowDailyPlayers(false);
              }}
              className="input-bg rounded-md px-3 py-1.5 text-xs font-bold border border-theme"
            >
              {sortedMonths.map(mKey => {
                const [y, m] = mKey.split('-');
                return (
                  <option key={mKey} value={mKey}>
                    {monthNames[parseInt(m) - 1]} {y}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-primary/20 text-primary-light hover:bg-primary hover:text-white border border-primary/30 text-xs font-black px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
          >
            {isAdding ? '✖️ إلغاء الإضافة' : '➕ إضافة جروب جديد'}
          </button>
        </div>
      </div>

      {/* Add New Group Form */}
      {isAdding && (
        <form
          onSubmit={handleAddGroupSubmit}
          className="card-bg rounded-lg p-5 border border-theme border-t-2 border-primary space-y-4 animate-fadeIn"
        >
          <h3 className="text-sm font-black text-primary">➕ تسجيل وإعداد جروب جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="اسم الجروب (مثال: جروب النخبة، جروب C)"
              className="input-bg rounded-md px-4 py-2.5 text-sm border border-theme text-right w-full"
              required
            />

            <select
              value={newGroupFocus}
              onChange={(e) => setNewGroupFocus(e.target.value as 'focus' | 'presence')}
              className="input-bg rounded-md px-4 py-2.5 text-sm border border-theme w-full"
            >
              <option value="focus">محتاج تركيز أكتر 🔥</option>
              <option value="presence">حضور فقط 👥</option>
            </select>

            <button
              type="submit"
              className="bg-success text-white text-xs font-black py-2.5 rounded-lg hover:opacity-90 transition-all border border-success/30"
            >
              حفظ الإعدادات 💾
            </button>
          </div>
        </form>
      )}

      {/* Classification Tabs */}
      <div className="tab-container-segmented rounded-xl p-1 flex w-full max-w-md mx-auto">
        <button
          onClick={() => setClassificationFilter('all')}
          className={`flex-1 py-1.5 text-center text-xs transition-all rounded-lg font-bold ${
            classificationFilter === 'all' ? 'tab-active-segmented' : 'tab-inactive-segmented'
          }`}
        >
          الكل ({allGroups.length})
        </button>
        <button
          onClick={() => setClassificationFilter('focus')}
          className={`flex-1 py-1.5 text-center text-xs transition-all rounded-lg font-bold ${
            classificationFilter === 'focus' ? 'tab-active-segmented' : 'tab-inactive-segmented'
          }`}
        >
          محتاج تركيز 🔥 ({allGroups.filter(g => getFocusType(g) === 'focus').length})
        </button>
        <button
          onClick={() => setClassificationFilter('presence')}
          className={`flex-1 py-1.5 text-center text-xs transition-all rounded-lg font-bold ${
            classificationFilter === 'presence' ? 'tab-active-segmented' : 'tab-inactive-segmented'
          }`}
        >
          حضور فقط 👥 ({allGroups.filter(g => getFocusType(g) === 'presence').length})
        </button>
      </div>

      {/* Groups List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.length === 0 ? (
          <div className="col-span-full text-center text-xs text-muted py-12 font-bold bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-theme rounded-xl">
            لا توجد جروبات مطابقة لهذا التصنيف 📋
          </div>
        ) : (
          filteredGroups.map((groupName, idx) => {
            const stats = groupsStats[groupName] || { revenue: 0, cost: 0, profit: 0, count: 0, totalAttendance: 0, membersCount: 0 };
            const focusType = getFocusType(groupName);
            const isSelected = selectedGroup === groupName;

            return (
              <div
                key={idx}
                className={`card-bg rounded-xl p-4 flex flex-col border transition-all duration-300 hover:scale-[1.01] select-none ${
                  isSelected ? 'border-primary shadow-[0_0_12px_rgba(249,115,22,0.15)] bg-primary-glow/5' : 'border-theme'
                } relative`}
                style={{
                  borderTop: focusType === 'focus' ? '4px solid var(--color-primary)' : '4px solid #6b7280'
                }}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 
                      onClick={() => {
                        setSelectedGroup(isSelected ? null : groupName);
                        setShowDailyPlayers(false);
                      }}
                      className="font-black text-main text-base cursor-pointer hover:text-primary transition-all flex items-center gap-1.5"
                    >
                      {groupName}
                      <span className="text-[10px] text-muted font-normal">
                        ({stats.membersCount} لاعب)
                      </span>
                    </h3>
                    
                    {/* Badge */}
                    <span 
                      onClick={() => handleToggleFocus(groupName, focusType)}
                      className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full mt-1 cursor-pointer transition-all ${
                        focusType === 'focus' 
                          ? 'bg-primary/10 text-primary-light border border-primary/20 hover:bg-primary/20' 
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 hover:bg-zinc-500/20'
                      }`}
                    >
                      {focusType === 'focus' ? 'محتاج تركيز أكتر 🔥' : 'حضور فقط 👥'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleFocus(groupName, focusType)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-theme text-xs"
                      title="تبديل مستوى الاهتمام"
                    >
                      {focusType === 'focus' ? '👥' : '🔥'}
                    </button>
                    {groupName !== 'العام' && (
                      <button
                        onClick={async () => {
                          if (confirm(`هل أنت متأكد من حذف إعدادات الجروب "${groupName}"؟`)) {
                            await onDeleteGroupConfig(groupName);
                            if (isSelected) setSelectedGroup(null);
                          }
                        }}
                        className="p-1 rounded bg-danger/10 hover:bg-danger hover:text-white border border-danger/20 text-xs"
                        title="حذف الجروب"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div 
                  onClick={() => {
                    setSelectedGroup(isSelected ? null : groupName);
                    setShowDailyPlayers(false);
                  }}
                  className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-theme/20 mt-2 cursor-pointer"
                >
                  <div>
                    <span className="text-[10px] text-muted block">الحضور هذا الشهر:</span>
                    <span className="font-black text-main">{stats.totalAttendance} حضور</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">العمليات المالية:</span>
                    <span className="font-black text-main">{stats.count} عملية</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-theme/10 flex justify-between items-center mt-1">
                    <span className="text-[10px] text-muted font-bold">إيرادات: <b className="text-success font-black">{stats.revenue} ج</b> | جيم: <b className="text-danger font-black">{stats.cost} ج</b></span>
                    <span className="text-primary-light font-black text-xs">
                      صافي: <b className="text-sm glow-text">{stats.profit} ج</b>
                    </span>
                  </div>
                </div>

                {/* Indication to click */}
                <div 
                  onClick={() => {
                    setSelectedGroup(isSelected ? null : groupName);
                    setShowDailyPlayers(false);
                  }}
                  className="text-[9px] text-muted text-center pt-2 border-t border-theme/10 mt-2 cursor-pointer hover:text-primary transition-all font-bold"
                >
                  {isSelected ? '🔼 إخفاء كشف لاعبي الجروب' : '🔽 عرض وتنزيل كشف لاعبي الجروب'}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Roster details section (only displays if a group is selected) */}
      {selectedGroup && groupDetails[selectedGroup] && (
        <div className="card-bg rounded-lg p-5 border border-theme select-none transition-all duration-500 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-theme/30 pb-4 mb-5">
            <div>
              <h3 className="text-base font-black text-primary glow-text flex items-center gap-2">
                <span>📋 كشف لاعبي الجروب:</span>
                <span className="text-primary-light font-black">{selectedGroup}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  getFocusType(selectedGroup) === 'focus'
                    ? 'bg-primary/10 text-primary-light border border-primary/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}>
                  {getFocusType(selectedGroup) === 'focus' ? 'تركيز 🔥' : 'حضور فقط 👥'}
                </span>
              </h3>
              <p className="text-[10px] text-muted font-bold mt-1">
                تصفية شهر: {monthNames[currentMonth]} {currentYear} | انقر فوق "تنزيل الكشف" لتصدير ملف Excel مصغر للمدربين
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-center">
              <button
                onClick={() => setShowDailyPlayers(!showDailyPlayers)}
                className="bg-slate-100 dark:bg-slate-900 border border-theme text-xs font-black px-4 py-2 rounded-lg hover:border-primary transition-all flex items-center gap-1.5 text-main"
              >
                <span>{showDailyPlayers ? '🙈 إخفاء اللاعبين بالحصة' : '👁️ إظهار اللاعبين بالحصة'}</span>
              </button>
              <button
                onClick={() => handleExportGroupCSV(selectedGroup)}
                className="bg-primary/10 text-primary-light border border-primary/30 text-xs font-black px-4 py-2 rounded-lg hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"
              >
                <span>📥 تنزيل الكشف (CSV)</span>
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${showDailyPlayers ? 'lg:grid-cols-2' : ''} gap-6 items-start`}>
            {/* 1. Monthly subscribers */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-theme/20 pb-2 mb-3">
                <h4 className="text-xs font-black text-primary flex items-center gap-1">
                  <span>📅 المشتركون شهرياً (حزم اشتراك)</span>
                </h4>
                <span className="bg-primary/10 text-primary-light text-[9px] font-black px-2 py-0.5 rounded-full">
                  {groupDetails[selectedGroup].monthlyPlayers.length} مشتركين
                </span>
              </div>

              {groupDetails[selectedGroup].monthlyPlayers.length === 0 ? (
                <div className="text-center text-xs text-muted py-8 font-bold bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-theme rounded-xl">
                  لا يوجد لاعبين باشتراك شهري مسجلين هذا الشهر
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {groupDetails[selectedGroup].monthlyPlayers.map((p, idx) => {
                    const isTop = p.attendanceCount > 0 && p.attendanceCount === groupDetails[selectedGroup].maxAttendance;
                    return (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-theme hover:border-primary/20 hover:bg-primary-glow/5 transition-all"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-black text-main flex items-center gap-1.5">
                            {p.name}
                            {isTop && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-0.5 font-bold animate-pulse">
                                👑 الأكثر نشاطاً
                              </span>
                            )}
                          </span>
                          <div className="flex flex-wrap gap-2 mt-0.5">
                            <span className="text-[9px] text-muted font-bold">
                              التجديدات: <b className="text-primary-light">{p.paymentCount}</b>
                            </span>
                            <span className="text-[9px] text-muted font-bold">
                              | المدفوع هذا الشهر: <b className="text-success">{p.paidAmount} ج.م</b>
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-md">
                          حضر {p.attendanceCount} مرات
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Daily walk-in players */}
            {showDailyPlayers && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-theme/20 pb-2 mb-3">
                  <h4 className="text-xs font-black text-primary flex items-center gap-1">
                    <span>🚶 اللاعبون بالحصة (جلسات فردية)</span>
                  </h4>
                  <span className="bg-primary/10 text-primary-light text-[9px] font-black px-2 py-0.5 rounded-full">
                    {groupDetails[selectedGroup].dailyPlayers.length} لاعبين
                  </span>
                </div>

                {groupDetails[selectedGroup].dailyPlayers.length === 0 ? (
                  <div className="text-center text-xs text-muted py-8 font-bold bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-theme rounded-xl">
                    لا يوجد لاعبين مسجلين بالحصة هذا الشهر
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {groupDetails[selectedGroup].dailyPlayers.map((p, idx) => {
                      const isTop = p.attendanceCount > 0 && p.attendanceCount === groupDetails[selectedGroup].maxAttendance;
                      return (
                        <div 
                          key={idx} 
                          className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-theme hover:border-primary/20 hover:bg-primary-glow/5 transition-all"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-main flex items-center gap-1.5">
                              {p.name}
                              {isTop && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-0.5 font-bold animate-pulse">
                                  👑 الأكثر نشاطاً
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-muted font-bold">
                              المدفوع هذا الشهر: <b className="text-success">{p.paidAmount} ج.م</b>
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-md">
                            حضر {p.attendanceCount} مرات
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
