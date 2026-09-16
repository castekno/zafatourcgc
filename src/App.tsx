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
      const syncedPackages = await syncPackagesWithSeats(plmCgkSeats);
      setPackages(syncedPackages);
    } catch (err) {
      console.error('Error loading data:', err);
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
      const rawSeats = await fetchLiveSeatData(true);
      const availableSeats = rawSeats.filter((s: SeatInfo) => s.sisaSeat > 0 && !isHajiKhususKemenag(s.group));
      setSeats(availableSeats);
      const plmCgkSeats = availableSeats.filter((s: SeatInfo) => isPlmOrCgk(s.group));
      const synced = await syncPackagesWithSeats(plmCgkSeats);
      setPackages(synced);
    } catch (err) {
      console.error('Error manually syncing packages with seats:', err);
    }
  };

  const handleClearPackages = async () => {
    await clearPackages();
    setPackages([]);
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
    await saveHotel(hotel);
    const updated = await getHotels();
    setHotels(updated);
  };

  const handleDeleteHotel = async (id: string) => {
    await deleteHotel(id);
    const updated = await getHotels();
    setHotels(updated);
  };

  // Packages CRUD
  const handleSavePackage = async (pkg: UmrahPackage) => {
    await savePackage(pkg);
    const updated = await getPackages();
    setPackages(updated);
  };

  const handleDeletePackage = async (id: string) => {
    await deletePackage(id);
    const updated = await getPackages();
    setPackages(updated);
  };

  // Documentation CRUD
  const handleSaveDoc = async (item: DocumentationItem) => {
    await saveDocumentation(item);
    const updated = await getDocumentations();
    setDocumentations(updated);
  };

  const handleDeleteDoc = async (id: string) => {
    await deleteDocumentation(id);
    const updated = await getDocumentations();
    setDocumentations(updated);
  };

  // Settings & Logo update (Saved in DB)
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
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
        <LiveSeatSection />

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
    </div>
  );
}
