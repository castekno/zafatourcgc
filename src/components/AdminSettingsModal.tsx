import { useState, useId, FormEvent, ChangeEvent } from 'react';
import {
  Settings as SettingsIcon,
  Upload,
  Database,
  CheckCircle,
  X,
  Image as ImageIcon,
  Save,
  RotateCcw,
} from 'lucide-react';
import { AppSettings } from '../types';
import { FIREBASE_PROJECT_INFO } from '../firebase/service';
import { DEFAULT_ZAFA_LOGO } from '../data/constants';
import { compressImageFile } from '../utils/imageCompress';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export default function AdminSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: AdminSettingsModalProps) {
  const adminBranchNameInputId = useId();
  const adminAddressInputId = useId();
  const adminWhatsAppInputId = useId();

  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [branchName, setBranchName] = useState(settings.branchName);
  const [address, setAddress] = useState(settings.address);
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageFile(file, 512, 512, 0.85);
        setLogoUrl(compressedBase64);
      } catch (err) {
        console.warn('Error compressing logo:', err);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          setLogoUrl(base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleResetDefaultLogo = () => {
    setLogoUrl(DEFAULT_ZAFA_LOGO);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveSettings({
        ...settings,
        logoUrl,
        branchName,
        address,
        whatsappNumber,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Settings save cancelled or failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-base">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <span>Pengaturan Logo & Database Firestore</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-sm">
          {/* Logo Section */}
          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-blue-950 text-sm flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-700" />
                  <span>Logo ZafaTour CGC (Tersimpan di Firestore)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload file logo baru atau gunakan foto logo yang telah disiapkan.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetDefaultLogo}
                className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Logo</span>
              </button>
            </div>

            {/* Current Logo Display */}
            <div className="p-4 bg-white rounded-xl border border-blue-200 flex items-center justify-center min-h-[90px]">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="ZafaTour Logo Preview"
                  className="max-h-20 max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xs text-slate-400">Belum ada logo terpilih</span>
              )}
            </div>

            {/* Upload or input URL */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL gambar logo atau gunakan tombol upload..."
                  value={logoUrl.startsWith('data:') ? '[Foto Logo Diupload (Base64)]' : logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shrink-0 transition-colors shadow-sm">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih File Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Branch & Contact Info */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Informasi Perwakilan & Kontak
            </h4>

            <div>
              <label htmlFor={adminBranchNameInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Perwakilan / Kantor
              </label>
              <input
                id={adminBranchNameInputId}
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label htmlFor={adminAddressInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Kantor (Citragrand City Palembang)
              </label>
              <textarea
                id={adminAddressInputId}
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label htmlFor={adminWhatsAppInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor WhatsApp Resmi
              </label>
              <input
                id={adminWhatsAppInputId}
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Firebase Information Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Status Parameter Firebase Firestore</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px]">Project Name:</span>
                <span className="font-mono font-bold text-slate-800">{FIREBASE_PROJECT_INFO.projectName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Project ID:</span>
                <span className="font-mono font-bold text-slate-800">{FIREBASE_PROJECT_INFO.projectId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Project Number:</span>
                <span className="font-mono font-bold text-slate-800">{FIREBASE_PROJECT_INFO.projectNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Firestore Database Name:</span>
                <span className="font-mono font-bold text-blue-700">{FIREBASE_PROJECT_INFO.firestoreDatabaseName}</span>
              </div>
            </div>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan & Logo berhasil disimpan ke Firestore!</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan ke Firestore...' : 'Simpan ke Firestore'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
