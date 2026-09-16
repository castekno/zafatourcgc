import { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  LogOut,
  Menu,
  X,
  Users,
  Settings as SettingsIcon,
  MapPin,
  Clock,
} from 'lucide-react';
import { UserLocationInfo, PrayerCountdownInfo } from '../types';

interface NavbarProps {
  logoUrl: string;
  isAdmin: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  currentLocation?: UserLocationInfo | null;
  prayerCountdown?: PrayerCountdownInfo | null;
}

export default function Navbar({
  logoUrl,
  isAdmin,
  onOpenLogin,
  onLogout,
  onOpenSettings,
  activeSection,
  onSelectSection,
  currentLocation,
  prayerCountdown,
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'packages', label: 'Paket Umroh & Haji' },
    { id: 'hotels', label: 'Master Hotel' },
    { id: 'seats', label: 'Sisa Kursi Seat' },
    { id: 'prayer', label: 'Jadwal Shalat' },
    { id: 'documentation', label: 'Dokumentasi' },
    { id: 'contact', label: 'Lokasi & Kontak' },
  ];

  const handleNavClick = (id: string) => {
    onSelectSection(id);
    setIsMobileMenuOpen(false);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScrollToTop = () => {
    onSelectSection('packages');
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header
      id="main-header"
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-sm"
    >
      {/* Ultra-minimal Herobar Info Strip: Guaranteed 1 single line on mobile (never wraps) */}
      <div
        id="prayer-herobar-strip"
        onClick={() => handleNavClick('prayer')}
        className="bg-slate-950 text-slate-300 border-b border-slate-800/80 px-3 sm:px-6 h-7.5 flex items-center cursor-pointer hover:bg-slate-900 transition-colors select-none"
        title="Klik untuk melihat Jadwal Shalat lengkap"
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap text-[10px] sm:text-xs">
          {/* Left: Location Pin */}
          <div className="flex items-center gap-1.5 min-w-0 shrink-0 text-emerald-400 font-medium">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[110px] xs:max-w-[170px] sm:max-w-none">
              {currentLocation?.cityName || 'Palembang'}
            </span>
            <span className="hidden md:inline text-slate-500 font-normal">
              (Koordinat Otomatis)
            </span>
          </div>

          {/* Right: Next Prayer & Countdown */}
          <div className="flex items-center gap-1.5 shrink-0 font-semibold text-slate-200">
            <Clock className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="text-slate-400 hidden xs:inline">Shalat:</span>
            <span className="text-amber-400 font-bold">
              {prayerCountdown?.nextPrayerName || '...'}
            </span>
            <span className="text-slate-300">
              {prayerCountdown?.nextPrayerTimeStr || ''}
            </span>
            {prayerCountdown && (
              <span className="text-sky-300 font-mono text-[9px] sm:text-[11px] bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700">
                -{prayerCountdown.timeRemainingStr}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div
            id="brand-logo-container"
            onClick={handleScrollToTop}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none py-1 min-w-0 group"
            title="Klik untuk kembali ke paling atas"
          >
            {logoUrl ? (
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <img
                  id="brand-logo-image"
                  src={logoUrl}
                  alt="Zafa Tour Umrah & Hajj Services"
                  className="h-10 sm:h-14 w-auto object-contain max-w-[110px] xs:max-w-[140px] sm:max-w-[200px] shrink-0 group-hover:opacity-90 transition-opacity"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col border-l border-blue-200 pl-2 sm:pl-3 min-w-0">
                  <span
                    id="brand-text-perwakilan-cgc"
                    className="text-[11px] sm:text-xs font-black text-blue-950 uppercase tracking-tight leading-tight truncate group-hover:text-sky-600 transition-colors"
                  >
                    Perwakilan CGC
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold leading-tight whitespace-nowrap">
                    Citragrand City Palembang
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white font-black text-lg sm:text-xl shrink-0 group-hover:bg-blue-800 transition-colors">
                  Z
                </div>
                <div className="min-w-0">
                  <div className="text-blue-950 font-black tracking-tight text-base sm:text-lg leading-tight">
                    ZAFA<span className="text-sky-600">TOUR</span>
                  </div>
                  <div className="flex flex-col">
                    <span
                      id="brand-text-perwakilan-cgc-fallback"
                      className="text-[10px] font-black text-blue-900 uppercase leading-none group-hover:text-sky-600 transition-colors"
                    >
                      Perwakilan CGC
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Citragrand City Palembang
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Nav Items */}
          <nav id="desktop-nav" className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  activeSection === item.id
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-slate-600 hover:text-blue-900 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="btn-nav-check-seats"
              onClick={() => handleNavClick('seats')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-lg sm:rounded-xl shadow-xs hover:shadow transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Cek Sisa Kursi Tersedia</span>
              <span className="inline sm:hidden">Cek Sisa Kursi</span>
            </button>

            {/* Desktop Admin / Login */}
            <div className="hidden sm:flex items-center gap-2">
              {isAdmin ? (
                <div className="flex items-center gap-1.5 bg-blue-50 p-1 rounded-xl border border-blue-200">
                  <button
                    id="btn-admin-settings"
                    onClick={onOpenSettings}
                    title="Pengaturan Logo & Database"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-blue-700" />
                    <span>Logo & DB</span>
                  </button>
                  <button
                    id="btn-admin-logout"
                    onClick={onLogout}
                    title="Logout Admin"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>
                </div>
              ) : (
                <button
                  id="btn-open-login"
                  onClick={onOpenLogin}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Login</span>
                </button>
              )}
            </div>

            {/* Mobile menu trigger */}
            <div className="flex sm:hidden items-center gap-1">
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-100 rounded-md">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </span>
              )}
              <button
                id="btn-mobile-menu-toggle"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="sm:hidden border-t border-blue-100 bg-white px-4 pt-2 pb-4 space-y-2 shadow-lg animate-in fade-in"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-lg ${
                activeSection === item.id
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              id="btn-mobile-check-seats"
              onClick={() => handleNavClick('seats')}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-bold text-white bg-sky-500 hover:bg-sky-400 rounded-xl shadow-xs transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Cek Sisa Kursi</span>
            </button>
            {isAdmin ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="flex-1 py-2 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span>Logo & DB</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="flex-1 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Admin</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="w-full py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                <span>Admin Login (Master & CRUD)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
