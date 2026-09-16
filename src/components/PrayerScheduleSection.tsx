import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Compass,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Navigation,
} from 'lucide-react';
import {
  PrayerName,
  PrayerTimeSlot,
  UserLocationInfo,
  PrayerCountdownInfo,
} from '../types';
import {
  calculatePrayerTimes,
  getNextPrayerCountdown,
  requestCurrentPosition,
  reverseGeocode,
  getSavedLocation,
  saveLocation,
  DEFAULT_LOCATION,
  calculateQiblaInfo,
} from '../services/prayerService';
import QiblaCompassModal from './QiblaCompassModal';

interface PrayerScheduleSectionProps {
  onLocationUpdated?: (loc: UserLocationInfo) => void;
}

export default function PrayerScheduleSection({
  onLocationUpdated,
}: PrayerScheduleSectionProps) {
  const [location, setLocation] = useState<UserLocationInfo>(DEFAULT_LOCATION);
  const [prayerSlots, setPrayerSlots] = useState<PrayerTimeSlot[]>([]);
  const [countdown, setCountdown] = useState<PrayerCountdownInfo | null>(null);
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<
    'idle' | 'detecting' | 'granted' | 'denied' | 'fallback'
  >('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isQiblaModalOpen, setIsQiblaModalOpen] = useState(false);

  // Update prayer times and countdown
  const refreshTimes = useCallback((coords: { latitude: number; longitude: number }) => {
    const now = new Date();
    const calculated = calculatePrayerTimes(coords, now);
    setPrayerSlots(calculated.slots);
    const cd = getNextPrayerCountdown(coords, now);
    setCountdown(cd);
  }, []);

  // Detect GPS Location automatically
  const handleDetectLocation = useCallback(async (isUserTriggered: boolean = false) => {
    setIsLoadingGps(true);
    setGpsStatus('detecting');
    setStatusMessage('Mendeteksi koordinat gadget Anda...');

    try {
      const coords = await requestCurrentPosition();
      setStatusMessage('Koordinat ditemukan. Menyelaraskan nama wilayah...');
      
      const geo = await reverseGeocode(coords.latitude, coords.longitude);
      
      const newLoc: UserLocationInfo = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        cityName: geo.city,
        districtName: geo.district,
        source: 'gps',
        updatedAt: new Date().toISOString(),
      };

      setLocation(newLoc);
      setGpsStatus('granted');
      setStatusMessage(`Lokasi GPS aktif: ${geo.city}${geo.district ? ` (${geo.district})` : ''}`);
      
      // Save in Firestore and localStorage
      await saveLocation(newLoc);
      if (onLocationUpdated) {
        onLocationUpdated(newLoc);
      }
      refreshTimes(newLoc);
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      // Fallback to saved or default location
      const fallback = await getSavedLocation();
      setLocation(fallback);
      setGpsStatus(err.code === 1 ? 'denied' : 'fallback');
      
      if (err.code === 1) {
        setStatusMessage('Izin lokasi ditolak/belum aktif di browser. Menggunakan jadwal standar ZafaTour CGC Palembang.');
      } else {
        setStatusMessage('GPS tidak merespons. Menggunakan jadwal koordinat ZafaTour CGC Palembang.');
      }
      refreshTimes(fallback);
      if (onLocationUpdated) {
        onLocationUpdated(fallback);
      }
    } finally {
      setIsLoadingGps(false);
    }
  }, [onLocationUpdated, refreshTimes]);

  // Initial load
  useEffect(() => {
    // 1. First load cached/default coordinates for instant render
    getSavedLocation().then((loc) => {
      setLocation(loc);
      refreshTimes(loc);
      if (onLocationUpdated) {
        onLocationUpdated(loc);
      }

      // 2. Automatically prompt browser Geolocation without requiring manual input
      handleDetectLocation(false);
    });
  }, []);

  // Tick countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (location) {
        const now = new Date();
        const cd = getNextPrayerCountdown(location, now);
        setCountdown(cd);

        // Recalculate slots if minute changed
        if (now.getSeconds() === 0) {
          const calculated = calculatePrayerTimes(location, now);
          setPrayerSlots(calculated.slots);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [location]);

  // Icon mapping per prayer (high contrast on light theme)
  const getPrayerIcon = (name: PrayerName) => {
    switch (name) {
      case 'Imsak':
        return <Moon className="w-5 h-5 text-indigo-600" />;
      case 'Subuh':
        return <Sunrise className="w-5 h-5 text-sky-600" />;
      case 'Terbit':
        return <Sun className="w-5 h-5 text-amber-600" />;
      case 'Dzuhur':
        return <Sun className="w-5 h-5 text-amber-600" />;
      case 'Ashar':
        return <Sun className="w-5 h-5 text-orange-600" />;
      case 'Maghrib':
        return <Sunset className="w-5 h-5 text-rose-600" />;
      case 'Isya':
        return <Moon className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const todayDateString = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <section
      id="prayer"
      className="py-14 sm:py-16 bg-white text-slate-900 relative overflow-hidden border-t border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-200">
              <Compass className="w-3.5 h-3.5 text-emerald-600" />
              <span>Deteksi Koordinat Otomatis</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Jadwal Waktu Shalat Real-Time
            </h2>
          </div>

          {/* Location & GPS Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                <MapPin className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="truncate">
                  {location.cityName}
                  {location.districtName ? `, ${location.districtName}` : ''}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                Lat: {location.latitude.toFixed(4)}° • Lng: {location.longitude.toFixed(4)}°
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-open-qibla-compass"
                onClick={() => setIsQiblaModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 active:scale-95 rounded-xl transition-all shrink-0 cursor-pointer shadow-xs"
                title="Buka Kompas Arah Kiblat Presisi"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Arah Kiblat</span>
              </button>

              <button
                id="btn-detect-gps-prayer"
                onClick={() => handleDetectLocation(true)}
                disabled={isLoadingGps}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl transition-all shrink-0 cursor-pointer shadow-xs"
                title="Perbarui koordinat dari gadget"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingGps ? 'animate-spin' : ''}`}
                />
                <span>{isLoadingGps ? 'Mendeteksi...' : 'Perbarui GPS'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* GPS Notification / Status banner */}
        {statusMessage && (
          <div
            className={`mb-6 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border ${
              gpsStatus === 'granted'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : gpsStatus === 'denied'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {gpsStatus === 'granted' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{statusMessage}</span>
          </div>
        )}

        {/* Countdown Hero Banner */}
        {countdown && (
          <div className="mb-8 bg-gradient-to-r from-emerald-50/90 via-slate-50 to-sky-50/80 rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Compass className="w-44 h-44 text-slate-900" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hitung Mundur Waktu Shalat Berikutnya</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span className="text-slate-700">Menuju Waktu</span>
                  <span className="text-emerald-800 font-extrabold px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-300">
                    {countdown.nextPrayerName}
                  </span>
                  <span className="text-slate-600 font-semibold">({countdown.nextPrayerTimeStr})</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1.5">
                  Hari ini: {todayDateString}
                </div>
              </div>

              {/* Big Digital Countdown */}
              <div className="flex flex-col items-start md:items-end">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                  Sisa Waktu
                </span>
                <div className="flex items-center gap-1 sm:gap-2">
                  {countdown.timeRemainingStr.split(':').map((unit, idx) => (
                    <div key={idx} className="flex items-center">
                      <div className="bg-white border border-slate-200/90 px-3 sm:px-4 py-2 sm:py-3 rounded-xl shadow-xs text-center min-w-[50px] sm:min-w-[62px]">
                        <span className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
                          {unit}
                        </span>
                        <span className="block text-[9px] sm:text-[10px] text-slate-500 uppercase font-sans font-bold mt-0.5">
                          {idx === 0 ? 'Jam' : idx === 1 ? 'Menit' : 'Detik'}
                        </span>
                      </div>
                      {idx < 2 && (
                        <span className="text-xl sm:text-3xl font-black text-emerald-600 px-1 sm:px-1.5 animate-pulse">
                          :
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7 Prayer Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {prayerSlots.map((slot) => {
            const isNext = slot.isNext;
            const isCurrent = slot.isCurrent;

            return (
              <div
                key={slot.name}
                id={`prayer-card-${slot.name.toLowerCase()}`}
                className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 relative border ${
                  isNext
                    ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-md shadow-emerald-100 ring-2 ring-emerald-200 scale-102 -translate-y-1'
                    : isCurrent
                    ? 'bg-blue-50/70 border-2 border-blue-400 shadow-xs shadow-blue-100'
                    : slot.passed
                    ? 'bg-slate-50/80 border-slate-200 text-slate-400 opacity-75 hover:opacity-100'
                    : 'bg-white border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      isNext
                        ? 'bg-emerald-100 border-emerald-200'
                        : isCurrent
                        ? 'bg-blue-100 border-blue-200'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    {getPrayerIcon(slot.name)}
                  </div>

                  {isNext && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                      Berikutnya
                    </span>
                  )}
                  {isCurrent && !isNext && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-xs">
                      Saat Ini
                    </span>
                  )}
                  {slot.passed && !isCurrent && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      Lewat
                    </span>
                  )}
                </div>

                {/* Name & Time */}
                <div>
                  <h4
                    className={`text-xs sm:text-sm font-bold tracking-wide ${
                      isNext
                        ? 'text-emerald-900'
                        : isCurrent
                        ? 'text-blue-900'
                        : slot.passed
                        ? 'text-slate-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {slot.name}
                  </h4>
                  <div
                    className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1 ${
                      isNext
                        ? 'text-emerald-950'
                        : isCurrent
                        ? 'text-blue-950'
                        : slot.passed
                        ? 'text-slate-400'
                        : 'text-slate-900'
                    }`}
                  >
                    {slot.timeString}
                  </div>
                </div>

                {/* Bottom label */}
                <div
                  className={`mt-3 pt-2.5 border-t text-[10px] flex items-center justify-between ${
                    isNext
                      ? 'border-emerald-200 text-emerald-700 font-medium'
                      : isCurrent
                      ? 'border-blue-200 text-blue-700 font-medium'
                      : 'border-slate-100 text-slate-500'
                  }`}
                >
                  <span>
                    {slot.name === 'Imsak'
                      ? 'Batas Sahur'
                      : slot.name === 'Terbit'
                      ? 'Syuruq'
                      : 'Wajib'}
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">WIB/Lokal</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup Modal Kompas Arah Kiblat Presisi */}
      <QiblaCompassModal
        isOpen={isQiblaModalOpen}
        onClose={() => setIsQiblaModalOpen(false)}
        location={location}
      />
    </section>
  );
}
