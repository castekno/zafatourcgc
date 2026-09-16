import { useState, useEffect, useRef } from 'react';
import {
  Compass,
  X,
  MapPin,
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
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean>(false);
  const [displayHeading, setDisplayHeading] = useState<number | null>(null);

  // Smooth continuous rotation state using physics-like lerp filter
  const headingTargetRef = useRef<number | null>(null);
  const currentHeadingRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (location) {
      const info = calculateQiblaInfo(location);
      setQiblaInfo(info);
    }
  }, [location]);

  // Handle smoothing loop for fluid, realistic liquid compass rotation
  useEffect(() => {
    let isRunning = true;

    const smoothStep = () => {
      if (!isRunning) return;

      if (headingTargetRef.current !== null) {
        if (currentHeadingRef.current === null) {
          currentHeadingRef.current = headingTargetRef.current;
        } else {
          // Calculate shortest angular difference (handling 359° -> 0° wraparound smoothly)
          let diff = (headingTargetRef.current - currentHeadingRef.current) % 360;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;

          // Gentle lerp factor for realistic dampening (0.12 = smooth and responsive)
          currentHeadingRef.current += diff * 0.12;
          currentHeadingRef.current = (currentHeadingRef.current + 360) % 360;
        }

        setDisplayHeading(currentHeadingRef.current);
      }

      animFrameRef.current = requestAnimationFrame(smoothStep);
    };

    if (isOpen) {
      animFrameRef.current = requestAnimationFrame(smoothStep);
    }

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen]);

  // Automatically activate sensor without button prompts
  useEffect(() => {
    if (!isOpen) {
      headingTargetRef.current = null;
      currentHeadingRef.current = null;
      setDisplayHeading(null);
      setHasOrientationSensor(false);
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let rawHeading: number | null = null;

      // iOS Safari (webkitCompassHeading: 0-360 with 0 = True North)
      if ((e as any).webkitCompassHeading !== undefined && (e as any).webkitCompassHeading !== null) {
        rawHeading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        // Android Chrome / Standard DeviceOrientation (alpha: 0-360)
        // In absolute orientation: heading = 360 - alpha
        rawHeading = (360 - e.alpha + 360) % 360;
      }

      if (rawHeading !== null && !isNaN(rawHeading)) {
        headingTargetRef.current = rawHeading;
        setHasOrientationSensor(true);
      }
    };

    // Attempt automatic orientation trigger
    if (typeof window !== 'undefined') {
      // For iOS 13+, attempt direct non-blocking permission call if available
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
        try {
          (DeviceOrientationEvent as any)
            .requestPermission()
            .then((state: string) => {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, true);
              }
            })
            .catch(() => {
              // Still attach standard listener as fallback
              window.addEventListener('deviceorientation', handleOrientation, true);
            });
        } catch {
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } else {
        // Android and standard browsers: Auto-listen directly
        window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isOpen]);

  if (!isOpen || !qiblaInfo) return null;

  // Visual rotations
  const compassDialRotation = displayHeading !== null ? -displayHeading : 0;
  const qiblaPointerRotation =
    displayHeading !== null ? qiblaInfo.degrees - displayHeading : qiblaInfo.degrees;

  // Phone aligned with Qibla (tolerance ±5 degrees)
  const isAlignedWithQibla =
    displayHeading !== null &&
    Math.abs(((qiblaInfo.degrees - displayHeading + 540) % 360) - 180) <= 5;

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
                <span className="truncate">
                  {location.cityName}{' '}
                  {location.districtName ? `(${location.districtName})` : ''}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                Koordinat: {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Jarak ke Ka'bah
              </span>
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
              Arah: <span className="text-emerald-800 font-bold">{qiblaInfo.cardinalDirection}</span>{' '}
              (serong ~{(qiblaInfo.degrees - 270).toFixed(1)}° dari Barat ke Utara)
            </div>
          </div>

          {/* Interactive Visual Compass Dial with Fluid Realistic Physics */}
          <div className="relative flex items-center justify-center my-2 select-none">
            {/* Compass Outer Ring with Realistic Depth and Glow */}
            <div
              className={`w-68 h-68 sm:w-76 sm:h-76 rounded-full border-4 relative flex items-center justify-center transition-colors duration-700 shadow-xl ${
                isAlignedWithQibla
                  ? 'border-emerald-500 bg-emerald-50/50 ring-8 ring-emerald-300/40 shadow-emerald-500/25'
                  : 'border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 shadow-slate-300/60'
              }`}
            >
              {/* Heading Indicator on Outer Top */}
              <div className="absolute -top-3.5 z-30 px-2 py-0.5 rounded-full bg-slate-900 text-[10px] font-mono font-bold text-emerald-400 border border-slate-700 shadow-xs">
                {displayHeading !== null ? `${Math.round(displayHeading)}°` : '0° U'}
              </div>

              {/* Rotating Compass Dial (N, E, S, W) */}
              <div
                className="absolute inset-2 rounded-full border border-dashed border-slate-300 will-change-transform flex items-center justify-center"
                style={{
                  transform: `rotate(${compassDialRotation}deg)`,
                  transition: 'transform 60ms linear',
                }}
              >
                {/* Cardinal Points */}
                <span className="absolute top-2.5 font-black text-xs text-rose-600 font-mono tracking-wider">
                  U (0°)
                </span>
                <span className="absolute right-3 font-bold text-xs text-slate-500 font-mono">
                  T (90°)
                </span>
                <span className="absolute bottom-2.5 font-bold text-xs text-slate-500 font-mono">
                  S (180°)
                </span>
                <span className="absolute left-3 font-bold text-xs text-slate-500 font-mono">
                  B (270°)
                </span>

                {/* Dial degree ticks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <div
                    key={deg}
                    className="absolute w-0.5 h-2.5 bg-slate-300 origin-bottom"
                    style={{
                      transform: `rotate(${deg}deg) translateY(-122px)`,
                    }}
                  />
                ))}

                {/* Fine degree ticks */}
                {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((deg) => (
                  <div
                    key={deg}
                    className="absolute w-0.5 h-1.5 bg-slate-200 origin-bottom"
                    style={{
                      transform: `rotate(${deg}deg) translateY(-123px)`,
                    }}
                  />
                ))}
              </div>

              {/* Qibla Direction Pointer / Kaaba Needle */}
              <div
                className="absolute w-full h-full flex items-center justify-center will-change-transform pointer-events-none"
                style={{
                  transform: `rotate(${qiblaPointerRotation}deg)`,
                  transition: 'transform 60ms linear',
                }}
              >
                {/* Kaaba Golden Arrow Indicator */}
                <div className="absolute top-3.5 flex flex-col items-center">
                  <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-md mb-1 transition-all ${
                    isAlignedWithQibla
                      ? 'bg-emerald-600 text-white scale-110 ring-2 ring-emerald-300'
                      : 'bg-emerald-800 text-white'
                  }`}>
                    🕋 KA'BAH
                  </div>
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-emerald-600 drop-shadow-md"></div>
                </div>

                {/* Fluid needle body */}
                <div className="w-1 h-38 bg-gradient-to-t from-transparent via-emerald-600/80 to-emerald-600 rounded-full"></div>
              </div>

              {/* Center Metallic Pivot with Heading Needle */}
              <div className="relative z-20 w-12 h-12 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-amber-400 shadow-lg flex items-center justify-center text-white">
                <Navigation className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Status info note (clean, no button required) */}
          {hasOrientationSensor ? (
            <div className={`rounded-xl p-3 text-xs flex items-center gap-2 transition-colors border ${
              isAlignedWithQibla
                ? 'bg-emerald-100/90 border-emerald-300 text-emerald-900 font-bold'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isAlignedWithQibla
                  ? 'Alhamdulillah! Posisi HP Anda kini sudah tepat lurus mengarah ke Ka\'bah.'
                  : 'Sensor kompas aktif. Putar perlahan HP Anda hingga jarum Ka\'bah lurus tegak ke atas.'}
              </span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Arahkan kompas atau sajadah Anda ke sudut <strong>{qiblaInfo.degrees}°</strong> dari arah Utara. Jika di dalam masjid/ruangan, posisikan sejajar arah Barat lalu geser serong ke kanan (Utara) sekitar 24.5°.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Koordinat Ka'bah: 21.4225° N, 39.8262° E</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer text-xs shadow-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
