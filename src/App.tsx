import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LiveSeatSection from './components/LiveSeatSection';
import HotelMasterSection from './components/HotelMasterSection';
import PackageSection from './components/PackageSection';
import PrayerScheduleSection from './components/PrayerScheduleSection';
import DocumentationSection from './components/DocumentationSection';
import Footer from './components/Footer';
import AdminLoginModal from './components/AdminLoginModal';
import AdminSettingsModal from './components/AdminSettingsModal';
import { AdminQuotaAlertModal } from './components/AdminQuotaAlertModal';
import {
  Hotel,
  UmrahPackage,
  DocumentationItem,
  AppSettings,
  SeatInfo,
  UserLocationInfo,
  PrayerCountdownInfo,
} from './types';
import { fetchLiveSeatData, isHajiKhususKemenag, isPlmOrCgk } from './services/seatService';
import {
  getSavedLocation,
  getNextPrayerCountdown,
  DEFAULT_LOCATION,
} from './services/prayerService';
import {
  getHotels,
  saveHotel,
  deleteHotel,
  getPackages,
  savePackage,
  deletePackage,
  syncPackagesWithSeats,
  clearPackages,
  getDocumentations,
  saveDocumentation,
  deleteDocumentation,
  getSettings,
  saveSettings,
  DEFAULT_APP_SETTINGS,
  testConnection,
  isFirestoreQuotaExceeded,
  setFirestoreQuotaExceeded,
  FirestoreQuotaExceededError,
} from './firebase/service';

export default function App() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [packages, setPackages] = useState<UmrahPackage[]>([]);
  const [documentations, setDocumentations] = useState<DocumentationItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Prayer and Location state
  const [currentLocation, setCurrentLocation] = useState<UserLocationInfo>(DEFAULT_LOCATION);
  const [prayerCountdown, setPrayerCountdown] = useState<PrayerCountdownInfo | null>(null);

  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('zafa_admin_logged_in') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  // Admin Quota Alert Modal State
  const [quotaAlert, setQuotaAlert] = useState<{
    isOpen: boolean;
    actionTitle: string;
    message?: string;
  }>({
    isOpen: false,
    actionTitle: '',
    message: '',
  });

  // Helper untuk memvalidasi batas kuota Firebase sebelum & saat operasi Admin (Update & Delete)
  const handleAdminActionWithQuotaProtection = async (
    actionName: string,
    actionFn: () => Promise<void>
  ) => {
    if (isFirestoreQuotaExceeded()) {
      setQuotaAlert({
        isOpen: true,
        actionTitle: actionName,
        message: `Batas kuota tulis harian database Firebase Firestore (Free Tier) telah tercapai hari ini. Operasi "${actionName}" dibatalkan untuk menjaga keutuhan data cloud.`,
      });
      throw new Error('QUOTA_EXCEEDED');
    }

    try {
      await actionFn();
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isQuota =
        err instanceof FirestoreQuotaExceededError ||
        errMsg.includes('resource-exhausted') ||
        errMsg.includes('Quota limit exceeded') ||
        errMsg.includes('Free daily write units') ||
        err?.code === 'resource-exhausted';

      if (isQuota) {
        setFirestoreQuotaExceeded(true);
        setQuotaAlert({
          isOpen: true,
          actionTitle: actionName,
          message: `Batas kuota tulis harian database Firebase Firestore (Free Tier) telah habis saat mengeksekusi "${actionName}". Operasi dibatalkan secara otomatis demi menjaga keutuhan data.`,
        });
        throw new Error('QUOTA_EXCEEDED');
      }
      throw err;
    }
  };

  // Load data and automatically sync packages with live seat data
  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch seat data
      let allSeats: SeatInfo[] = [];
      try {
        const rawSeats = await fetchLiveSeatData(true);
        const availableSeats = rawSeats.filter((s: SeatInfo) => s.sisaSeat > 0 && !isHajiKhususKemenag(s.group));
        setSeats(availableSeats);
        allSeats = availableSeats;
      } catch (seatErr) {
        console.warn('Seat fetch fallback in loadAllData:', seatErr);
      }

      // 2. Fetch hotels, documentations, and settings (untouched)
      const [hList, dList, sData] = await Promise.all([
        getHotels(),
        getDocumentations(),
        getSettings(),
      ]);
      setHotels(hList);
      setDocumentations(dList);
      setSettings(sData);

      // 3. Synchronize package database with online seat data every load/refresh:
      // - Packages from seat data become package names in database (khusus PLM & CGK)
      // - If already exists, refresh latest departure dates & seat counts
      // - If all dates are gone, departureDates becomes empty -> "Paket Habis"
      // - Category: "UMRAH", "HAJI", "HAJI KHUSUS"
      const plmCgkSeats = allSeats.filter((s: SeatInfo) => isPlmOrCgk(s.group));
      // Sinkronisasi otomatis dengan Dirty Checking:
      // Hanya menulis ke Firestore jika departureDates / jadwal seat terbukti ada perbedaan, 0 write jika sama persis
      let syncedPackages: UmrahPackage[] = [];
      try {
        syncedPackages = await syncPackagesWithSeats(plmCgkSeats, true);
      } catch (syncErr) {
        console.warn('Sinkronisasi paket ke Firestore dilewati, beralih ke cache lokal:', syncErr);
        syncedPackages = await syncPackagesWithSeats(plmCgkSeats, false);
      }
      setPackages(syncedPackages);
    } catch (err) {
      console.warn('Peringatan saat memuat data awal, memuat dari penyimpanan lokal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
    loadAllData();

    // Load initial saved/default location and countdown for Herobar
    getSavedLocation().then((loc) => {
      setCurrentLocation(loc);
      setPrayerCountdown(getNextPrayerCountdown(loc, new Date()));
    });
  }, []);

  // Live countdown ticker for Herobar
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentLocation) {
        setPrayerCountdown(getNextPrayerCountdown(currentLocation, new Date()));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentLocation]);

  const handleSyncPackages = async () => {
    try {
      await handleAdminActionWithQuotaProtection('Sinkronisasi Data Seat ke Paket', async () => {
        const rawSeats = await fetchLiveSeatData(true);
        const availableSeats = rawSeats.filter((s: SeatInfo) => s.sisaSeat > 0 && !isHajiKhususKemenag(s.group));
        setSeats(availableSeats);
        const plmCgkSeats = availableSeats.filter((s: SeatInfo) => isPlmOrCgk(s.group));
        // true: sinkronisasi eksplisit oleh Admin disimpan ke cloud database jika kuota tersedia
        const synced = await syncPackagesWithSeats(plmCgkSeats, true);
        setPackages(synced);
      });
    } catch (err: any) {
      if (err?.message !== 'QUOTA_EXCEEDED') {
        console.error('Error manually syncing packages with seats:', err);
      }
    }
  };

  const handleClearPackages = async () => {
    try {
      await handleAdminActionWithQuotaProtection('Hapus Semua Paket', async () => {
        await clearPackages();
        setPackages([]);
      });
    } catch (err: any) {
      if (err?.message !== 'QUOTA_EXCEEDED') {
        console.error('Error clearing packages:', err);
      }
    }
  };

  // Admin Login / Logout
  const handleLoginSuccess = () => {
    setIsAdmin(true);
    sessionStorage.setItem('zafa_admin_logged_in', 'true');
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('zafa_admin_logged_in');
  };

  // Hotels CRUD
  const handleSaveHotel = async (hotel: Hotel) => {
    const isUpdate = hotels.some((h) => h.id === hotel.id);
    await handleAdminActionWithQuotaProtection(isUpdate ? 'Update Hotel' : 'Tambah Hotel', async () => {
      await saveHotel(hotel);
      const updated = await getHotels();
      setHotels(updated);
    });
  };

  const handleDeleteHotel = async (id: string) => {
    await handleAdminActionWithQuotaProtection('Hapus Hotel', async () => {
      await deleteHotel(id);
      const updated = await getHotels();
      setHotels(updated);
    });
  };

  // Packages CRUD
  const handleSavePackage = async (pkg: UmrahPackage) => {
    const isUpdate = packages.some((p) => p.id === pkg.id);
    await handleAdminActionWithQuotaProtection(isUpdate ? 'Update Paket' : 'Tambah Paket', async () => {
      await savePackage(pkg);
      const updated = await getPackages();
      setPackages(updated);
    });
  };

  const handleDeletePackage = async (id: string) => {
    await handleAdminActionWithQuotaProtection('Hapus Paket', async () => {
      await deletePackage(id);
      const updated = await getPackages();
      setPackages(updated);
    });
  };

  // Documentation CRUD
  const handleSaveDoc = async (item: DocumentationItem) => {
    const isUpdate = documentations.some((d) => d.id === item.id);
    await handleAdminActionWithQuotaProtection(isUpdate ? 'Update Dokumentasi' : 'Tambah Dokumentasi', async () => {
      await saveDocumentation(item);
      const updated = await getDocumentations();
      setDocumentations(updated);
    });
  };

  const handleDeleteDoc = async (id: string) => {
    await handleAdminActionWithQuotaProtection('Hapus Dokumentasi', async () => {
      await deleteDocumentation(id);
      const updated = await getDocumentations();
      setDocumentations(updated);
    });
  };

  // Settings & Logo update (Saved in DB)
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await handleAdminActionWithQuotaProtection('Update Pengaturan & Logo', async () => {
      await saveSettings(newSettings);
      setSettings(newSettings);
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800 antialiased selection:bg-sky-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        logoUrl={settings.logoUrl}
        isAdmin={isAdmin}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentLocation={currentLocation}
        prayerCountdown={prayerCountdown}
      />

      {/* Admin Notice when Firestore Free Tier Quota is Exceeded */}
      {isAdmin && isFirestoreQuotaExceeded() && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-center text-xs text-rose-800 flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
          <span>
            <strong>Pemberitahuan Admin:</strong> Batas kuota tulis Firestore harian (20.000 writes/hari) telah tercapai. Operasi <strong>Update</strong> dan <strong>Delete</strong> dibatalkan demi keamanan data cloud hingga kuota di-reset otomatis besok (~14:00 WIB). Pengunjung tetap dapat melihat situs normal.
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow">
        {/* Group 1: Group Paket Haji & Umroh */}
        <PackageSection
          packages={packages}
          hotels={hotels}
          seats={seats}
          isAdmin={isAdmin}
          onSavePackage={handleSavePackage}
          onDeletePackage={handleDeletePackage}
          onSyncWithSeats={handleSyncPackages}
          onClearPackages={handleClearPackages}
        />

        {/* Master Hotel (Makkah & Madinah, up to 6 photos, star, map, distance) */}
        <HotelMasterSection
          hotels={hotels}
          isAdmin={isAdmin}
          onSaveHotel={handleSaveHotel}
          onDeleteHotel={handleDeleteHotel}
        />

        {/* Real-Time Live Seat Data (https://seat.zafatour.com/ with seats > 0) */}
        <LiveSeatSection packages={packages} />

        {/* Jadwal Shalat Real-Time Otomatis Berdasarkan Koordinat Gadget (Sebelum Group Dokumentasi) */}
        <PrayerScheduleSection
          onLocationUpdated={(loc) => {
            setCurrentLocation(loc);
            setPrayerCountdown(getNextPrayerCountdown(loc, new Date()));
          }}
        />

        {/* Group 2: Group Dokumentasi (Dynamic photos without count limit) */}
        <DocumentationSection
          documentations={documentations}
          isAdmin={isAdmin}
          onSaveDoc={handleSaveDoc}
          onDeleteDoc={handleDeleteDoc}
        />
      </main>

      {/* Footer */}
      <Footer logoUrl={settings.logoUrl} />

      {/* Admin Login Modal (password: shahnam85) */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Settings Modal (Logo, DB Config) */}
      <AdminSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      {/* Admin Quota Exceeded Notification Modal */}
      <AdminQuotaAlertModal
        isOpen={quotaAlert.isOpen}
        actionTitle={quotaAlert.actionTitle}
        message={quotaAlert.message}
        onClose={() => setQuotaAlert({ isOpen: false, actionTitle: '', message: '' })}
      />
    </div>
  );
}
