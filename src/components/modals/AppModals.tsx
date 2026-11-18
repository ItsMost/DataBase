/**
 * Small confirmation dialogs: delete player, backup export, import, import preview, payment receipt.
 */
import React from 'react';
import type { Player, AppSettings } from '../../types';
import { buildReceiptMessage, whatsAppLink, type ReceiptInfo } from '../../lib/messages';

export interface ImportPreview {
  players: Player[];
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  notInFileCount: number;
}

interface AppModalsProps {
  players: Player[];
  appSettings: AppSettings;
  playerToDeleteId: string | null;
  setPlayerToDeleteId: (id: string | null) => void;
  handleDeletePlayer: () => void;
  showBackupModal: boolean;
  setShowBackupModal: (v: boolean) => void;
  backupText: string;
  handleCopyBackup: () => void;
  handleDownloadBackupFile: () => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  importText: string;
  setImportText: (v: string) => void;
  handleExecuteImport: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importPreview: ImportPreview | null;
  setImportPreview: (v: ImportPreview | null) => void;
  importBusy: boolean;
  handleConfirmImport: () => void;
  receipt: ReceiptInfo | null;
  setReceipt: (v: ReceiptInfo | null) => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  players,
  appSettings,
  playerToDeleteId,
  setPlayerToDeleteId,
  handleDeletePlayer,
  showBackupModal,
  setShowBackupModal,
  backupText,
  handleCopyBackup,
  handleDownloadBackupFile,
  showImportModal,
  setShowImportModal,
  importText,
  setImportText,
  handleExecuteImport,
  handleFileUpload,
  importPreview,
  setImportPreview,
  importBusy,
  handleConfirmImport,
  receipt,
  setReceipt,
}) => (
  <>
      {/* B. Player Delete Confirmation Modal */}
      {playerToDeleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-6 w-full max-w-sm text-center border border-theme">
            <h3 className="text-xl font-bold text-danger mb-2">تحذير النظام!</h3>
            <p className="text-main mb-6">هل أنت متأكد من حذف هذا اللاعب تماماً من القاعدة؟</p>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePlayer}
                className="w-1/2 bg-danger text-danger border border-danger font-bold rounded-md px-4 py-2"
              >
                تأكيد
              </button>
              <button
                onClick={() => setPlayerToDeleteId(null)}
                className="w-1/2 input-bg font-bold rounded-md px-4 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D. Backup/Export JSON Code Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm relative flex flex-col border border-theme">
            <button
              onClick={() => setShowBackupModal(false)}
              className="absolute top-4 left-4 text-muted hover:text-main input-bg p-1 rounded-full border border-theme"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-lg font-bold text-blue-500 mb-2">حفظ النسخة الاحتياطية</h3>
            <p className="text-xs text-muted mb-4">يفضل استخدام (تنزيل ملف) والاحتفاظ به لحماية بياناتك بالكامل.</p>
            <textarea
              readOnly
              value={backupText}
              className="w-full h-24 input-bg rounded p-3 text-left text-xs mb-4 opacity-70"
              style={{ direction: 'ltr', resize: 'none' }}
            ></textarea>
            <div className="flex gap-2">
              <button
                onClick={handleCopyBackup}
                className="w-1/2 bg-blue-500/20 text-blue-400 font-bold rounded px-3 py-2 border border-blue-500/50 hover:bg-blue-500 hover:text-white transition-colors text-sm"
              >
                نسخ الكود 📋
              </button>
              <button
                onClick={handleDownloadBackupFile}
                className="w-1/2 bg-blue-500 text-white font-bold rounded px-3 py-2 shadow-lg text-sm"
              >
                تنزيل ملف 📁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E. Import JSON Code Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm relative flex flex-col border border-theme">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-4 left-4 text-muted hover:text-main input-bg p-1 rounded-full border border-theme"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-lg font-bold text-green-500 mb-2">استرجاع البيانات</h3>
            <p className="text-xs text-muted mb-4">اختر ملف النسخة الاحتياطية الذي قمت بتنزيله، أو الصق الكود هنا.</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="أو الصق الكود هنا..."
              className="w-full h-24 input-bg rounded p-3 text-left text-xs mb-4"
              style={{ direction: 'ltr', resize: 'none' }}
            ></textarea>
            
            <input
              type="file"
              id="importFileInput"
              accept=".txt,.json"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleExecuteImport}
                className="w-1/2 bg-green-500/20 text-green-400 font-bold rounded px-3 py-2 border border-green-500/50 hover:bg-green-500 hover:text-white transition-colors text-sm"
              >
                لصق واسترجاع 🔄
              </button>
              <button
                onClick={() => document.getElementById('importFileInput')?.click()}
                className="w-1/2 bg-green-500 text-white font-bold rounded px-3 py-2 shadow-lg text-sm"
              >
                رفع الملف 📁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F. Import confirmation */}
      {importPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-theme text-right">
            <h3 className="text-lg font-bold text-green-500 mb-3">تأكيد الاسترجاع</h3>
            <div className="space-y-1 text-sm mb-3">
              <div>لاعيبة جديدة هتتضاف: <b className="text-success">{importPreview.newCount}</b></div>
              <div>لاعيبة هتتغير لنسخة الملف: <b className="text-amber-400">{importPreview.changedCount}</b></div>
              <div>زي ما هم: <b className="text-muted">{importPreview.unchangedCount}</b></div>
              <div>مش موجودين في الملف (هيفضلوا زي ما هم): <b className="text-main">{importPreview.notInFileCount}</b></div>
            </div>
            <p className="text-[11px] text-muted mb-4 leading-relaxed">
              قبل أي تغيير هتتعمل نسخة احتياطية أوتوماتيك. مفيش أي لاعب هيتمسح.
            </p>
            <div className="flex gap-2">
              <button
                disabled={importBusy}
                onClick={handleConfirmImport}
                className="w-1/2 bg-green-500 text-white font-bold rounded px-3 py-2 disabled:opacity-50"
              >
                {importBusy ? 'جاري...' : 'تأكيد الاسترجاع'}
              </button>
              <button
                disabled={importBusy}
                onClick={() => setImportPreview(null)}
                className="w-1/2 input-bg font-bold rounded px-3 py-2 border border-theme"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. WhatsApp receipt after a payment */}
      {receipt && (() => {
        const rp = players.find(p => p.id === receipt.playerId);
        if (!rp) return null;
        const text = buildReceiptMessage(rp, receipt, appSettings);
        const link = whatsAppLink(rp.phone, text);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-theme text-right">
              <h3 className="text-lg font-bold text-success mb-2">🧾 إيصال الدفع: {rp.name}</h3>
              <pre className="input-bg rounded p-3 text-xs whitespace-pre-wrap font-sans border border-theme mb-4">{text}</pre>
              <div className="flex gap-2">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setReceipt(null)}
                    className="w-1/2 text-white font-bold rounded px-3 py-2 text-center"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    إرسال واتساب 💬
                  </a>
                ) : (
                  <div className="w-1/2 text-[11px] text-muted text-center self-center">مفيش رقم موبايل للاعب</div>
                )}
                <button onClick={() => setReceipt(null)} className="w-1/2 input-bg font-bold rounded px-3 py-2 border border-theme">
                  قفل
                </button>
              </div>
            </div>
          </div>
        );
      })()}
  </>
);
