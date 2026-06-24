import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Player, HistoryEntry } from '../types';

interface GroupsSectionProps {
  players: Player[];
  groupsConfig: HistoryEntry[];
  onSaveGroupConfig: (name: string) => Promise<void>;
  onDeleteGroupConfig: (name: string) => Promise<void>;
  onRenameGroupConfig: (oldName: string, newName: string) => Promise<void>;
  onMovePlayerToGroup: (playerId: string, groupName: string) => Promise<void>;
}

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  players,
  groupsConfig,
  onSaveGroupConfig,
  onDeleteGroupConfig,
  onRenameGroupConfig,
  onMovePlayerToGroup,
}) => {
  // States
  const [newGroupName, setNewGroupName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPlayerDropdown(null);
        setPlayerSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute all active (non-system, non-deleted) players
  const activePlayers = useMemo(() =>
    players.filter(p => !p.isSystem && !p.isDeleted),
    [players]
  );

  // Compute groups
  const allGroups = useMemo(() => {
    const defaultGroups = ['العام'];
    const playerGroups = activePlayers.map(p => p.sport || 'العام');
    const configuredGroups = groupsConfig.map(h => h.desc);
    return [...new Set([...defaultGroups, ...playerGroups, ...configuredGroups])];
  }, [activePlayers, groupsConfig]);

  // Group players by their group name
  const groupedPlayers = useMemo(() => {
    const map: Record<string, Player[]> = {};
    allGroups.forEach(g => { map[g] = []; });
    activePlayers.forEach(p => {
      const groupName = p.sport || 'العام';
      if (!map[groupName]) map[groupName] = [];
      map[groupName].push(p);
    });
    return map;
  }, [activePlayers, allGroups]);

  // Players available to add to a specific group (not already in it)
  const getAvailablePlayers = (groupName: string) => {
    return activePlayers
      .filter(p => (p.sport || 'العام') !== groupName)
      .filter(p => !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()));
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (allGroups.includes(newGroupName.trim())) {
      alert('اسم الجروب موجود بالفعل');
      return;
    }
    await onSaveGroupConfig(newGroupName.trim());
    setNewGroupName('');
    setIsAdding(false);
  };

  const handleRenameSubmit = async (oldName: string) => {
    if (editNameValue.trim() && editNameValue.trim() !== oldName) {
      await onRenameGroupConfig(oldName, editNameValue.trim());
    }
    setEditingGroupName(null);
  };

  const handleMovePlayer = async (playerId: string, groupName: string) => {
    await onMovePlayerToGroup(playerId, groupName);
    setPlayerSearch('');
    setShowPlayerDropdown(null);
  };

  const handleRemoveFromGroup = async (playerId: string) => {
    await onMovePlayerToGroup(playerId, 'العام');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-bg rounded-xl p-4 border border-theme flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">👥</span>
          <h2 className="text-base font-black text-primary glow-text">إدارة الجروبات</h2>
          <span className="text-[10px] font-bold text-muted bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
            {allGroups.length} جروب
          </span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`text-xs font-black px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
            isAdding
              ? 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 border border-zinc-500/30'
              : 'bg-primary/20 text-primary-light hover:bg-primary hover:text-white border border-primary/30'
          }`}
        >
          {isAdding ? '✖️ إلغاء' : '➕ جروب جديد'}
        </button>
      </div>

      {/* Add Group Form */}
      {isAdding && (
        <form
          onSubmit={handleAddGroup}
          className="card-bg rounded-xl p-5 border border-theme border-t-2 border-t-primary animate-fadeIn"
        >
          <h3 className="text-sm font-black text-primary mb-3">➕ إنشاء جروب جديد</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="اسم الجروب (مثال: جروب A، المتقدمين...)"
              className="input-bg rounded-lg px-4 py-2.5 text-sm border border-theme text-right flex-1"
              autoFocus
              required
            />
            <button
              type="submit"
              className="bg-success text-white text-xs font-black px-5 py-2.5 rounded-lg hover:opacity-90 transition-all border border-success/30 whitespace-nowrap"
            >
              إنشاء 💾
            </button>
          </div>
        </form>
      )}

      {/* Groups Grid */}
      <div className="space-y-4">
        {allGroups.map((groupName) => {
          const members = groupedPlayers[groupName] || [];
          const isExpanded = expandedGroup === groupName;
          const isEditing = editingGroupName === groupName;

          return (
            <div
              key={groupName}
              className={`card-bg rounded-xl border transition-all duration-300 overflow-hidden ${
                isExpanded
                  ? 'border-primary shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                  : 'border-theme hover:border-primary/30'
              }`}
            >
              {/* Group Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer select-none"
                onClick={() => {
                  if (!isEditing) setExpandedGroup(isExpanded ? null : groupName);
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Group Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${
                    groupName === 'العام'
                      ? 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20'
                      : 'bg-primary/15 text-primary-light border border-primary/20'
                  }`}>
                    {members.length}
                  </div>

                  {/* Group Name */}
                  {isEditing ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="input-bg rounded-lg px-3 py-1.5 text-sm border border-theme text-right font-bold text-main w-40"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') await handleRenameSubmit(groupName);
                          if (e.key === 'Escape') setEditingGroupName(null);
                        }}
                      />
                      <button
                        onClick={() => handleRenameSubmit(groupName)}
                        className="bg-success text-white px-2 py-1 rounded-lg text-xs hover:opacity-90 transition-all"
                      >✔️</button>
                      <button
                        onClick={() => setEditingGroupName(null)}
                        className="bg-zinc-500/20 text-zinc-400 px-2 py-1 rounded-lg text-xs hover:bg-zinc-500/40 transition-all"
                      >✖️</button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-sm font-black text-main">{groupName}</h3>
                      <span className="text-[10px] text-muted font-bold">
                        {members.length} لاعب
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {groupName !== 'العام' && !isEditing && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroupName(groupName);
                          setEditNameValue(groupName);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-theme text-xs transition-all"
                        title="تعديل الاسم"
                      >✏️</button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`هل أنت متأكد من حذف "${groupName}"؟\nسيتم نقل اللاعبين إلى جروب العام.`)) {
                            await onDeleteGroupConfig(groupName);
                            if (isExpanded) setExpandedGroup(null);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger hover:text-white border border-danger/20 text-xs transition-all"
                        title="حذف الجروب"
                      >🗑️</button>
                    </>
                  )}
                  <span className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-theme/30 animate-fadeIn">
                  {/* Add Player Section */}
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 border-b border-theme/20" ref={showPlayerDropdown === groupName ? dropdownRef : undefined}>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-black text-primary">➕ إضافة لاعب للجروب</span>
                      </div>
                      <input
                        type="text"
                        value={showPlayerDropdown === groupName ? playerSearch : ''}
                        onChange={(e) => {
                          setPlayerSearch(e.target.value);
                          setShowPlayerDropdown(groupName);
                        }}
                        onFocus={() => setShowPlayerDropdown(groupName)}
                        placeholder="ابحث عن لاعب لإضافته..."
                        className="input-bg rounded-lg px-4 py-2.5 text-sm border border-theme text-right w-full"
                      />

                      {/* Dropdown */}
                      {showPlayerDropdown === groupName && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 card-bg border border-theme rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {getAvailablePlayers(groupName).length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted font-bold">
                              {playerSearch ? 'لا يوجد لاعب بهذا الاسم' : 'كل اللاعبين موجودين في هذا الجروب بالفعل'}
                            </div>
                          ) : (
                            getAvailablePlayers(groupName).map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleMovePlayer(p.id, groupName)}
                                className="w-full text-right px-4 py-2.5 text-sm font-bold text-main hover:bg-primary/10 hover:text-primary-light transition-all border-b border-theme/10 last:border-b-0 flex items-center justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-xs text-muted">من: {p.sport || 'العام'}</span>
                                </span>
                                <span>{p.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="p-4">
                    {members.length === 0 ? (
                      <div className="text-center text-xs text-muted py-8 font-bold border border-dashed border-theme rounded-xl bg-slate-50/30 dark:bg-slate-900/10">
                        لا يوجد لاعبين في هذا الجروب حالياً
                        <br />
                        <span className="text-[10px]">ابحث عن لاعب فوق لإضافته 👆</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-muted">أعضاء الجروب</span>
                        </div>
                        {members.map((p, idx) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-theme hover:border-primary/20 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              {/* Player Number */}
                              <span className="text-[10px] text-muted font-bold w-5 text-center">{idx + 1}</span>
                              {/* Player Info */}
                              <div>
                                <span className="text-xs font-black text-main block">{p.name}</span>
                                {p.phone && (
                                  <span className="text-[10px] text-muted font-bold">{p.phone}</span>
                                )}
                              </div>
                            </div>

                            {/* Remove from group (move to العام) */}
                            {groupName !== 'العام' && (
                              <button
                                onClick={() => handleRemoveFromGroup(p.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-danger/10 hover:bg-danger hover:text-white border border-danger/20 text-[10px] transition-all"
                                title="نقل للعام"
                              >
                                ✖️
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
