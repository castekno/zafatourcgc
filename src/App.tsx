import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import LiveSeatSection from './components/LiveSeatSection';
import HotelMasterSection from './components/HotelMasterSection';
import PackageSection from './components/PackageSection';
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
} from './types';
import {
  getHotels,
  saveHotel,
  deleteHotel,
  getPackages,
  savePackage,
  deletePackage,
  getDocumentations,
  saveDocumentation,
  deleteDocumentation,
  getSettings,
  saveSettings,
  DEFAULT_APP_SETTINGS,
} from './firebase/service';

export default function App() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [packages, setPackages] = useState<UmrahPackage[]>([]);
  const [documentations, setDocumentations] = useState<DocumentationItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('zafa_admin_logged_in') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  // Load data from persistent service
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [hList, pList, dList, sData] = await Promise.all([
        getHotels(),
        getPackages(),
        getDocumentations(),
        getSettings(),
      ]);
      setHotels(hList);
      setPackages(pList);
      setDocumentations(dList);
      setSettings(sData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeatData = async () => {
    try {
      const res = await fetch('/api/seats');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSeats(data.data.filter((s: SeatInfo) => s.sisaSeat > 0));
      }
    } catch (err) {
      console.error('Error loading seats:', err);
    }
  };

  useEffect(() => {
    loadAllData();
    fetchSeatData();
  }, []);

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
      />

      {/* Hero Section */}
      <HeroBanner
        onExplorePackages={() => {
          document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onCheckSeats={() => {
          document.getElementById('seats')?.scrollIntoView({ behavior: 'smooth' });
        }}
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
