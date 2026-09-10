import { useState, useId, FormEvent } from 'react';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { ADMIN_PASSWORD } from '../data/constants';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function AdminLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: AdminLoginModalProps) {
  const adminPasswordInputId = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === ADMIN_PASSWORD) {
      onLoginSuccess();
      setPassword('');
      onClose();
    } else {
      setError('Password salah. Silakan coba lagi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-base">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
              <Lock className="w-5 h-5" />
            </div>
            <span>Login Administrator</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Masukkan password administrator untuk mengaktifkan akses CRUD Master
          Hotel, Paket Umroh/Haji, Dokumentasi, dan Pengaturan Logo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={adminPasswordInputId} className="block text-xs font-bold text-slate-700 mb-1">
              Password Admin
            </label>
            <input
              id={adminPasswordInputId}
              type="password"
              required
              autoFocus
              placeholder="Masukkan password admin..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-xl shadow-md transition-all"
            >
              Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
