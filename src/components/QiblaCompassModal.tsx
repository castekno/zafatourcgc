import { useState, useEffect } from 'react';
import {
  Compass,
  X,
  MapPin,
  RotateCw,
  Navigation,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { UserLocationInfo } from '../types';
import { calculateQiblaInfo, QiblaInfo } from '../services/prayerService';

interface QiblaCompassModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: UserLocationInfo;
}

export default function QiblaCompassModal({
  isOpen,
  onClose,
  location,
}: QiblaCompassModalProps) {
  const [qiblaInfo, setQiblaInfo] = useState<QiblaInfo | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean>(false);
  const [sensorPermission, setSensorPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');

  useEffect(() => {
    if (location) {
      const info = calculateQiblaInfo(location);
      setQiblaInfo(info);
    }
  }, [location]);

  // Request device orientation / compass sensor on mobile
  const requestCompassPermission = async () => {
    // For iOS 13+ devices
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setSensorPermission('granted');
          attachOrientationListener();
        } else {
          setSensorPermission('denied');
        }
      } catch (err) {
        console.warn('iOS orientation permission error:', err);
        setSensorPermission('denied');
      }
    } else {
      // Android / Standard Browsers
      attachOrientationListener();
    }
  };

  const attachOrientationListener = () => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // iOS webkitCompassHeading is True North (0-360)
      if ((e as any).webkitCompassHeading !== undefined) {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Standard Android deviceorientation (alpha is relative to start orientation or magnetic north)
        heading = 360 - e.alpha;
      }

      if (heading !== null && !isNaN(heading)) {
        setDeviceHeading(Math.round(heading));
        setHasOrientationSensor(true);
        setSensorPermission('granted');
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
  };

  useEffect(() => {
    if (isOpen) {
      // Test if sensor available immediately
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        // iOS requires explicit user interaction, while Android works directly
        if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
          setSensorPermission('prompt');
        } else {
          attachOrientationListener();
        }
      } else {
        setSensorPermission('unsupported');
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', () => {});
      }
    };
  }, [isOpen]);

  if (!isOpen || !qiblaInfo) return null;

  // Calculate rotation difference between device heading and Kaaba direction
  // When deviceHeading is null, show true north upright (0 deg)
  const compassDialRotation = deviceHeading !== null ? -deviceHeading : 0;
  const qiblaPointerRotation =
    deviceHeading !== null
      ? qiblaInfo.degrees - deviceHeading
      : qiblaInfo.degrees;

  // Is phone pointing right at Qibla (tolerance ±4 degrees)
  const isAlignedWithQibla =
    deviceHeading !== null &&
    Math.abs(((qiblaInfo.degrees - deviceHeading + 540) % 360) - 180) <= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div
        id="qibla-modal-card"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                Kompas Arah Kiblat Presisi
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Metode Hisab Falak Spherical Ka'bah Makkah
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup Kompas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Location Details Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{location.cityName} {location.districtName ? `(${location.districtName})` : ''}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                Koordinat: {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Jarak ke Ka'bah</span>
              <span className="text-xs font-black text-emerald-700 font-mono">
                {qiblaInfo.distanceKm.toLocaleString('id-ID')} km
              </span>
            </div>
          </div>

          {/* Precision Degree Highlight */}
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sudut Azimut Kiblat dari Utara Sejati
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-emerald-700 mt-1 flex items-center justify-center gap-1">
              <span>{qiblaInfo.degrees}°</span>
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1">
              Arah: <span className="text-emerald-800 font-bold">{qiblaInfo.cardinalDirection}</span> (serong ~{(qiblaInfo.degrees - 270).toFixed(1)}° dari Barat ke Utara)
            </div>
          </div>

          {/* Interactive Visual Compass Dial */}
          <div className="relative flex items-center justify-center my-2 select-none">
            {/* Compass Outer Ring */}
            <div
              className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 relative flex items-center justify-center shadow-lg transition-colors duration-500 ${
                isAlignedWithQibla
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-emerald-500/20 ring-4 ring-emerald-200'
                  : 'border-slate-300 bg-slate-50 shadow-slate-200'
              }`}
            >
              {/* Rotating Compass Dial (N, E, S, W degrees) */}
              <div
                className="absolute inset-2 rounded-full border border-dashed border-slate-300 transition-transform duration-200 ease-out flex items-center justify-center"
                style={{ transform: `rotate(${compassDialRotation}deg)` }}
              >
                {/* Cardinal Points */}
                <span className="absolute top-2 font-black text-xs text-rose-600 font-mono">U (0°)</span>
                <span className="absolute right-2 font-bold text-xs text-slate-500 font-mono">T (90°)</span>
                <span className="absolute bottom-2 font-bold text-xs text-slate-500 font-mono">S (180°)</span>
                <span className="absolute left-2 font-bold text-xs text-slate-500 font-mono">B (270°)</span>

                {/* Dial ticks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <div
                    key={deg}
                    className="absolute w-0.5 h-2 bg-slate-300 origin-bottom"
                    style={{
                      transform: `rotate(${deg}deg) translateY(-118px)`,
                    }}
                  />
                ))}
              </div>

              {/* Qibla Direction Needle / Kaaba Pointer */}
              <div
                className="absolute w-full h-full flex items-center justify-center transition-transform duration-300 ease-out pointer-events-none"
                style={{ transform: `rotate(${qiblaPointerRotation}deg)` }}
              >
                {/* Kaaba Golden Arrow Indicator */}
                <div className="absolute top-4 flex flex-col items-center">
                  <div className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[9px] font-black tracking-wider uppercase shadow-xs mb-1">
                    🕋 KA'BAH
                  </div>
                  <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[18px] border-b-emerald-600 drop-shadow-sm"></div>
                </div>

                {/* Line through center */}
                <div className="w-0.5 h-36 bg-gradient-to-t from-transparent via-emerald-600 to-emerald-600/20 rounded-full"></div>
              </div>

              {/* Center Pivot */}
              <div className="relative z-20 w-12 h-12 rounded-full bg-slate-900 border-2 border-amber-400 shadow-md flex items-center justify-center text-white">
                <Navigation className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Sensor Info & Mobile Calibration Notice */}
          {hasOrientationSensor ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Sensor kompas aktif (Heading HP: {deviceHeading}°). Putar HP Anda hingga panah Ka'bah lurus ke atas.
              </span>
            </div>
          ) : sensorPermission === 'prompt' ? (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Aktifkan sensor orientasi HP untuk kompas otomatis berputar</span>
              </div>
              <button
                onClick={requestCompassPermission}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-[11px] shrink-0 cursor-pointer shadow-xs"
              >
                Izinkan Sensor
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Arahkan kompas/HP ke sudut <strong>{qiblaInfo.degrees}°</strong> dari arah Utara. Jika di dalam ruangan, hadapkan sajadah sedikit ke kanan dari arah barat murni (~25° ke arah kanan/utara).
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Koordinat Ka'bah: 21.4225° N, 39.8262° E</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer text-xs shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
