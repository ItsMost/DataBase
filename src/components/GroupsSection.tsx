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

// Predefined color palette for groups
const GROUP_COLORS = [
  { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', accent: '#f97316', text: '#fb923c', glow: 'rgba(249, 115, 22, 0.08)' },
  { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', accent: '#3b82f6', text: '#60a5fa', glow: 'rgba(59, 130, 246, 0.08)' },
  { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', accent: '#10b981', text: '#34d399', glow: 'rgba(16, 185, 129, 0.08)' },
  { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', accent: '#a855f7', text: '#c084fc', glow: 'rgba(168, 85, 247, 0.08)' },
  { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', accent: '#ec4899', text: '#f472b6', glow: 'rgba(236, 72, 153, 0.08)' },
  { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', accent: '#eab308', text: '#facc15', glow: 'rgba(234, 179, 8, 0.08)' },
  { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', accent: '#14b8a6', text: '#2dd4bf', glow: 'rgba(20, 184, 166, 0.08)' },
  { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)', accent: '#f43f5e', text: '#fb7185', glow: 'rgba(244, 63, 94, 0.08)' },
];

const GROUP_EMOJIS = ['🏆', '⚡', '🔥', '💎', '🌟', '🎯', '🚀', '👑', '💫', '🎖️'];

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  players,
  groupsConfig,
  onSaveGroupConfig,
  onDeleteGroupConfig,
  onRenameGroupConfig,
  onMovePlayerToGroup,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const activePlayers = useMemo(() =>
    players.filter(p => !p.isSystem && !p.isDeleted),
    [players]
  );

  const allGroups = useMemo(() => {
    const defaultGroups = ['العام'];
    const playerGroups = activePlayers.map(p => p.sport || 'العام');
    const configuredGroups = groupsConfig.map(h => h.desc);
    return [...new Set([...defaultGroups, ...playerGroups, ...configuredGroups])];
  }, [activePlayers, groupsConfig]);

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

  const getGroupColor = (idx: number) => GROUP_COLORS[idx % GROUP_COLORS.length];
  const getGroupEmoji = (idx: number) => GROUP_EMOJIS[idx % GROUP_EMOJIS.length];

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

  const totalPlayers = activePlayers.length;

  return (
    <div className="space-y-6">
      {/* ═══════════════ Dashboard Header ═══════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(59, 130, 246, 0.05) 50%, rgba(168, 85, 247, 0.08) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(249, 115, 22, 0.15)',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-30px', left: '-30px', width: '100px', height: '100px',
          borderRadius: '50%', background: 'rgba(249, 115, 22, 0.06)', filter: 'blur(20px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20px', right: '-20px', width: '80px', height: '80px',
          borderRadius: '50%', background: 'rgba(59, 130, 246, 0.06)', filter: 'blur(15px)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', position: 'relative', zIndex: 1 }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px' }}>👥</span>
              <span className="text-primary glow-text">إدارة الجروبات</span>
            </h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(249, 115, 22, 0.12)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.2)',
              }}>
                {allGroups.length} جروب
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)',
              }}>
                {totalPlayers} لاعب إجمالي
              </span>
            </div>
          </div>

          <button
            onClick={() => { setIsAdding(!isAdding); setTimeout(() => inputRef.current?.focus(), 100); }}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isAdding ? 'rgba(100,100,100,0.15)' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: isAdding ? '#9ca3af' : '#fff',
              border: isAdding ? '1px solid rgba(100,100,100,0.3)' : '1px solid rgba(249, 115, 22, 0.5)',
              boxShadow: isAdding ? 'none' : '0 4px 15px rgba(249, 115, 22, 0.25)',
            }}
          >
            {isAdding ? '✖️ إلغاء' : '➕ جروب جديد'}
          </button>
        </div>
      </div>

      {/* ═══════════════ Add Group Form ═══════════════ */}
      {isAdding && (
        <form
          onSubmit={handleAddGroup}
          className="animate-fadeIn"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderTop: '3px solid #10b981',
          }}
        >
          <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#34d399', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✨</span> إنشاء جروب جديد
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              ref={inputRef}
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="اسم الجروب (مثال: جروب A، المتقدمين...)"
              className="input-bg"
              style={{
                flex: 1,
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '13px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'right',
              }}
              required
            />
            <button
              type="submit"
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 900,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              إنشاء 💾
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════ Groups Grid ═══════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {allGroups.map((groupName, idx) => {
          const members = groupedPlayers[groupName] || [];
          const isExpanded = expandedGroup === groupName;
          const isEditing = editingGroupName === groupName;
          const color = idx === 0
            ? { bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.25)', accent: '#64748b', text: '#94a3b8', glow: 'rgba(100, 116, 139, 0.06)' }
            : getGroupColor(idx - 1);
          const emoji = idx === 0 ? '🌐' : getGroupEmoji(idx - 1);

          return (
            <div
              key={groupName}
              className="animate-fadeIn"
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: `1px solid ${isExpanded ? color.accent : color.border}`,
                background: isExpanded ? color.glow : 'transparent',
                boxShadow: isExpanded ? `0 8px 30px ${color.glow}, 0 0 0 1px ${color.border}` : `0 2px 8px rgba(0,0,0,0.05)`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
              }}
            >
              {/* Top accent bar */}
              <div style={{
                height: '3px',
                background: `linear-gradient(90deg, ${color.accent}, transparent)`,
              }} />

              {/* ─── Card Header ─── */}
              <div
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.2s ease',
                }}
                className="card-bg"
                onClick={() => {
                  if (!isEditing) setExpandedGroup(isExpanded ? null : groupName);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Group Avatar */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${color.bg}, ${color.glow})`,
                    border: `2px solid ${color.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: `0 4px 12px ${color.glow}`,
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{emoji}</span>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: color.text, lineHeight: 1, marginTop: '2px' }}>
                      {members.length}
                    </span>
                  </div>

                  {/* Group Name */}
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="input-bg"
                        style={{
                          borderRadius: '10px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          border: `1px solid ${color.border}`,
                          textAlign: 'right',
                          fontWeight: 700,
                          width: '140px',
                        }}
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') await handleRenameSubmit(groupName);
                          if (e.key === 'Escape') setEditingGroupName(null);
                        }}
                      />
                      <button
                        onClick={() => handleRenameSubmit(groupName)}
                        style={{
                          padding: '6px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none',
                        }}
                      >✔️</button>
                      <button
                        onClick={() => setEditingGroupName(null)}
                        style={{
                          padding: '6px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer',
                          background: 'rgba(100,100,100,0.2)', color: '#9ca3af', border: 'none',
                        }}
                      >✖️</button>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 900, margin: 0, lineHeight: 1.3 }} className="text-main">
                        {groupName}
                      </h3>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: color.text }}>
                        {members.length} لاعب
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {groupName !== 'العام' && !isEditing && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroupName(groupName);
                          setEditNameValue(groupName);
                        }}
                        style={{
                          width: '32px', height: '32px', borderRadius: '10px', border: `1px solid ${color.border}`,
                          background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s ease',
                        }}
                        title="تعديل الاسم"
                      >✏️</button>
                      {confirmDelete === groupName ? (
                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={async () => {
                              await onDeleteGroupConfig(groupName);
                              if (isExpanded) setExpandedGroup(null);
                              setConfirmDelete(null);
                            }}
                            style={{
                              padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                              background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none',
                            }}
                          >تأكيد</button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            style={{
                              padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                              background: 'rgba(100,100,100,0.2)', color: '#9ca3af', border: 'none',
                            }}
                          >إلغاء</button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(groupName);
                          }}
                          style={{
                            width: '32px', height: '32px', borderRadius: '10px',
                            border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s ease',
                          }}
                          title="حذف الجروب"
                        >🗑️</button>
                      )}
                    </>
                  )}

                  {/* Expand Arrow */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: isExpanded ? color.bg : 'rgba(100,100,100,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    fontSize: '10px',
                    color: isExpanded ? color.text : '#9ca3af',
                  }}>
                    ▼
                  </div>
                </div>
              </div>

              {/* ─── Expanded Content ─── */}
              {isExpanded && (
                <div className="animate-fadeIn" style={{ borderTop: `1px solid ${color.border}` }}>
                  {/* Add Player Section */}
                  <div
                    ref={showPlayerDropdown === groupName ? dropdownRef : undefined}
                    style={{
                      padding: '16px 20px',
                      background: color.glow,
                      borderBottom: `1px solid ${color.border}`,
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 800, color: color.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>➕</span> إضافة لاعب للجروب
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={showPlayerDropdown === groupName ? playerSearch : ''}
                        onChange={(e) => {
                          setPlayerSearch(e.target.value);
                          setShowPlayerDropdown(groupName);
                        }}
                        onFocus={() => setShowPlayerDropdown(groupName)}
                        placeholder="🔍 ابحث عن لاعب لإضافته..."
                        className="input-bg"
                        style={{
                          width: '100%',
                          borderRadius: '12px',
                          padding: '10px 16px',
                          fontSize: '12px',
                          border: `1px solid ${color.border}`,
                          textAlign: 'right',
                          transition: 'all 0.2s ease',
                        }}
                      />

                      {/* Dropdown */}
                      {showPlayerDropdown === groupName && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '6px',
                          zIndex: 50,
                          borderRadius: '14px',
                          border: `1px solid ${color.border}`,
                          boxShadow: `0 12px 40px rgba(0,0,0,0.2), 0 0 0 1px ${color.border}`,
                          maxHeight: '200px',
                          overflowY: 'auto',
                          backdropFilter: 'blur(20px)',
                        }} className="card-bg">
                          {getAvailablePlayers(groupName).length === 0 ? (
                            <div style={{
                              padding: '20px',
                              textAlign: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                            }} className="text-muted">
                              {playerSearch ? '❌ لا يوجد لاعب بهذا الاسم' : '✅ كل اللاعبين موجودين في الجروب'}
                            </div>
                          ) : (
                            getAvailablePlayers(groupName).slice(0, 20).map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleMovePlayer(p.id, groupName)}
                                style={{
                                  width: '100%',
                                  textAlign: 'right',
                                  padding: '10px 16px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  border: 'none',
                                  background: 'transparent',
                                  transition: 'all 0.15s ease',
                                  borderBottom: '1px solid rgba(100,100,100,0.08)',
                                }}
                                className="text-main"
                                onMouseEnter={(e) => {
                                  (e.target as HTMLElement).style.background = color.bg;
                                }}
                                onMouseLeave={(e) => {
                                  (e.target as HTMLElement).style.background = 'transparent';
                                }}
                              >
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  background: 'rgba(100,100,100,0.1)',
                                  whiteSpace: 'nowrap',
                                }} className="text-muted">
                                  من: {p.sport || 'العام'}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {p.name}
                                  <span style={{ fontSize: '14px' }}>➕</span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="card-bg" style={{ padding: '16px 20px' }}>
                    {members.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '32px 16px',
                        borderRadius: '14px',
                        border: `2px dashed ${color.border}`,
                        background: color.glow,
                      }}>
                        <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📭</span>
                        <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-muted">
                          لا يوجد لاعبين في هذا الجروب
                        </span>
                        <br />
                        <span style={{ fontSize: '10px', fontWeight: 600 }} className="text-muted">
                          ابحث فوق لإضافة لاعبين 👆
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${color.border}`,
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 700 }} className="text-muted">
                            أعضاء الجروب
                          </span>
                          <span style={{
                            fontSize: '9px', fontWeight: 800, padding: '2px 10px', borderRadius: '20px',
                            background: color.bg, color: color.text, border: `1px solid ${color.border}`,
                          }}>
                            {members.length} لاعب
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto', paddingLeft: '4px' }}>
                          {members.map((p, memberIdx) => (
                            <div
                              key={p.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid rgba(100,100,100,0.1)',
                                transition: 'all 0.2s ease',
                                cursor: 'default',
                                background: memberIdx % 2 === 0 ? 'transparent' : 'rgba(100,100,100,0.03)',
                              }}
                              className="group"
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = color.border;
                                (e.currentTarget as HTMLElement).style.background = color.glow;
                                const btn = (e.currentTarget as HTMLElement).querySelector('.remove-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(100,100,100,0.1)';
                                (e.currentTarget as HTMLElement).style.background = memberIdx % 2 === 0 ? 'transparent' : 'rgba(100,100,100,0.03)';
                                const btn = (e.currentTarget as HTMLElement).querySelector('.remove-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '0';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* Player number badge */}
                                <div style={{
                                  width: '28px', height: '28px', borderRadius: '8px',
                                  background: color.bg, border: `1px solid ${color.border}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '10px', fontWeight: 900, color: color.text, flexShrink: 0,
                                }}>
                                  {memberIdx + 1}
                                </div>
                                <div>
                                  <span style={{ fontSize: '12px', fontWeight: 800, display: 'block', lineHeight: 1.3 }} className="text-main">
                                    {p.name}
                                  </span>
                                  {p.phone && (
                                    <span style={{ fontSize: '10px', fontWeight: 600, direction: 'ltr', display: 'block' }} className="text-muted">
                                      {p.phone}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Remove button */}
                              {groupName !== 'العام' && (
                                <button
                                  className="remove-btn"
                                  onClick={() => handleRemoveFromGroup(p.id)}
                                  style={{
                                    opacity: 0,
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="نقل للعام"
                                >
                                  نقل للعام ✖️
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
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
