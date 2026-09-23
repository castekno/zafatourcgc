import React from 'react';
import { AlertTriangle, X, ShieldAlert, Clock, CloudOff } from 'lucide-react';

interface AdminQuotaAlertModalProps {
  isOpen: boolean;
  actionTitle: string;
  message?: string;
  onClose: () => void;
}

export const AdminQuotaAlertModal: React.FC<AdminQuotaAlertModalProps> = ({
  isOpen,
  actionTitle,
  message,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-200">
        {/* Header with Warning Color */}
        <div className="bg-rose-50 px-6 py-5 border-b border-rose-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-rose-100 text-rose-800 mb-1">
                Pemberitahuan Khusus Admin
              </span>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                Operasi Dibatalkan: Kuota Firebase Penuh
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
            title="Tutup Pesan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm text-slate-600">
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900 text-xs">
                Tindakan yang dibatalkan: <span className="underline">{actionTitle}</span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                {message ||
                  'Batas kuota tulis harian database Firebase Firestore (Free Tier) telah mencapai batas maksimal untuk hari ini. Operasi update atau delete dibatalkan demi keamanan dan konsistensi data.'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <CloudOff className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Keamanan Data:</strong> Database membatalkan perubahan ini agar data di browser tidak berbeda dengan data di cloud server Firebase.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Waktu Reset:</strong> Kuota gratis Firebase akan di-reset otomatis oleh Google setiap 24 jam (sekitar pukul 14:00 WIB). Setelah reset, Anda dapat kembali melakukan update dan delete secara normal.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Tutup & Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
