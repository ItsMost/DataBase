/**
 * Export (CSV/JSON), safe import with preview + backup, deep recovery.
 * Moved out of App.tsx without changing the logic.
 */
import React, { useState } from 'react';
import type { Player } from '../types';
import { db } from '../services/db';
import { syncAllToCloud } from '../services/sync';
import { uploadSafetySnapshot } from '../services/backup';
import { localToday } from '../lib/dates';
import type { AppContextValue } from './appContext';

export function useDataTools(ctx: AppContextValue) {
  const { players, setPlayers, triggerToast, checkExpiration } = ctx;
  const getTodayDate = localToday;
  // General Backup/Import text modals
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [importText, setImportText] = useState('');
  // Import preview (what will change) before anything is written
  const [importPreview, setImportPreview] = useState<{
    players: Player[];
    newCount: number;
    changedCount: number;
    unchangedCount: number;
    notInFileCount: number;
  } | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Deep backup database recover scanner
  const handleDeepRecover = async () => {
    const recoveredMap = new Map<string, Player>();
    
    // 1. Read all local storage values that look like JSON arrays
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          if (Array.isArray(data)) {
            data.forEach((p: Player) => {
              if (p && p.id && p.name) {
                recoveredMap.set(String(p.id), p);
              }
            });
          }
        } catch {}
      }
    }

    // 2. Read native IDB ('SystemPlayersDB')
    try {
      const idbPlayers = await new Promise<Player[]>((resolve) => {
        const req = indexedDB.open("SystemPlayersDB", 1);
        req.onsuccess = (e) => {
          const nativeDb = (e.target as IDBOpenDBRequest).result;
          if (!nativeDb.objectStoreNames.contains("state")) {
            nativeDb.close();
            resolve([]);
            return;
          }
          try {
            const tx = nativeDb.transaction("state", "readonly");
            const store = tx.objectStore("state");
            const getReq = store.get("playersData");
            getReq.onsuccess = () => {
              nativeDb.close();
              resolve(Array.isArray(getReq.result) ? getReq.result : []);
            };
            getReq.onerror = () => {
              nativeDb.close();
              resolve([]);
            };
          } catch {
            nativeDb.close();
            resolve([]);
          }
        };
        req.onerror = () => resolve([]);
      });

      idbPlayers.forEach((p) => {
        if (p && p.id && p.name) {
          recoveredMap.set(String(p.id), p);
        }
      });
    } catch {}

    // 3. Keep newer records
    players.forEach(p => {
      recoveredMap.set(String(p.id), p);
    });

    const newPlayers = Array.from(recoveredMap.values());
    
    if (newPlayers.length > players.length) {
      await db.players.bulkPut(newPlayers);
      if (navigator.onLine) {
        await syncAllToCloud(newPlayers);
      }
      setPlayers(newPlayers);
      triggerToast(`تم استرجاع ${newPlayers.length} ملفات بنجاح! ✅`);
    } else {
      triggerToast("لم يتم العثور على أي ملفات احتياطية قديمة.", true);
    }
  };

  // CSV Sheet download
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // Excel UTF-8 BOM to support Arabic letters
    csvContent += "الرقم,الاسم,رقم الموبايل,الرياضة,حالة الاشتراك,تاريخ البداية,إجمالي الدفع,إجمالي تكلفة الجيم,صافي الربح\n";
    
    players.filter(p => !p.isSystem && !p.isDeleted).forEach(p => {
      let totalPaid = 0;
      let totalCost = 0;
      if (p.history) {
        p.history.forEach(h => {
          totalPaid += h.paid || 0;
          totalCost += h.cost || 0;
        });
      }
      const net = totalPaid - totalCost;
      const expInfo = checkExpiration(p);
      const status = p.subType && !expInfo.isExpired ? "ساري" : "منتهي/غير مسدد";
      
      const cleanName = (p.name || '').replace(/,/g, ' ');
      const cleanSport = (p.sport || '').replace(/,/g, ' ');
      
      const row = `${p.number || '-'},${cleanName},${p.phone || '-'},${cleanSport},${status},${p.startDate || '-'},${totalPaid},${totalCost},${net}`;
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Gym_Players_Report_${getTodayDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast("تم تصدير الداتا بنجاح في ملف إكسيل 📊");
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(players);
    setBackupText(dataStr);
    setShowBackupModal(true);
  };

  const handleCopyBackup = () => {
    navigator.clipboard.writeText(backupText);
    triggerToast("تم نسخ الكود! اذهب لعمل (لصق/Paste) في مكان آمن ✅");
    setShowBackupModal(false);
  };

  const handleDownloadBackupFile = () => {
    const blob = new Blob([backupText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Gym_System_Backup_${getTodayDate()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast("تم تنزيل ملف النسخة الاحتياطية بنجاح 📁✅");
    setShowBackupModal(false);
  };

  const handleImportJSON = () => {
    setImportText('');
    setShowImportModal(true);
  };

  // Step 1: read the file/code and show what will change (nothing is written yet)
  const handleExecuteImport = async () => {
    if (!importText.trim()) {
      alert("الرجاء لصق الكود أولاً!");
      return;
    }
    try {
      const parsed = JSON.parse(importText);
      // Accept the manual export (array) and the weekly backup ({ players: [...] })
      const list: Player[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.players) ? parsed.players : null;
      if (!list || list.some(p => !p || !p.id)) {
        triggerToast("كود تالف وغير صحيح!", true);
        return;
      }
      const current = new Map((await db.players.toArray()).map(p => [String(p.id), p]));
      const fileIds = new Set(list.map(p => String(p.id)));
      let newCount = 0;
      let changedCount = 0;
      let unchangedCount = 0;
      list.forEach(p => {
        const cur = current.get(String(p.id));
        if (!cur) newCount++;
        else if (JSON.stringify(cur) !== JSON.stringify(p)) changedCount++;
        else unchangedCount++;
      });
      const notInFileCount = [...current.values()].filter(p => !p.isSystem && !fileIds.has(String(p.id))).length;
      setImportPreview({ players: list, newCount, changedCount, unchangedCount, notInFileCount });
    } catch {
      triggerToast("كود غير مكتمل أو منتهي الصلاحية!", true);
    }
  };

  // Step 2 (after confirmation): automatic safety backup, then add/update only (nothing is deleted)
  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      const snap = await uploadSafetySnapshot('pre-import');
      if (!snap.uploaded) {
        // Cloud backup not possible: keep a copy on the device and download it
        try {
          localStorage.setItem('pre_import_backup', snap.json);
        } catch {}
        const blob = new Blob([snap.json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Backup_before_import_${getTodayDate()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      await db.players.bulkPut(importPreview.players);
      if (navigator.onLine) {
        await syncAllToCloud(importPreview.players);
      }
      setPlayers(await db.players.toArray());
      triggerToast(
        snap.uploaded
          ? "تم الاسترجاع ✅ (اتعملت نسخة احتياطية على السحابة قبلها)"
          : "تم الاسترجاع ✅ (النسخة الاحتياطية اتنزلت على الجهاز)"
      );
      setImportPreview(null);
      setShowImportModal(false);
    } finally {
      setImportBusy(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
  };

  return {
    handleDeepRecover,
    handleExportCSV,
    handleExportJSON,
    handleCopyBackup,
    handleDownloadBackupFile,
    handleImportJSON,
    handleExecuteImport,
    handleConfirmImport,
    handleFileUpload,
    showBackupModal,
    setShowBackupModal,
    showImportModal,
    setShowImportModal,
    backupText,
    importText,
    setImportText,
    importPreview,
    setImportPreview,
    importBusy,
  };
}
