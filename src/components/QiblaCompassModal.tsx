import { useState, useEffect, useRef } from 'react';
import {
  Compass,
  X,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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

  // Smooth continuous rotation state using physics lerp dampening
  const headingTargetRef = useRef<number | null>(null);
  const currentHeadingRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (location) {
      const info = calculateQiblaInfo(location);
      setQiblaInfo(info);
    }
  }, [location]);

  // Smooth animation frame loop for fluid needle physics
  useEffect(() => {
    let isRunning = true;

    const smoothStep = () => {
      if (!isRunning) return;

      if (headingTargetRef.current !== null) {
        if (currentHeadingRef.current === null) {
          currentHeadingRef.current = headingTargetRef.current;
        } else {
          // Shortest path angular difference (smooth wrap-around across 360°/0°)
          let diff = (headingTargetRef.current - currentHeadingRef.current) % 360;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;

          // Lerp factor (0.10 gives realistic liquid damping)
          currentHeadingRef.current += diff * 0.10;
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

  // Sensor listener
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

      // iOS Safari (webkitCompassHeading: 0° = True North, increments clockwise)
      if ((e as any).webkitCompassHeading !== undefined && (e as any).webkitCompassHeading !== null) {
        rawHeading = Number((e as any).webkitCompassHeading);
      } else if (e.alpha !== null && e.alpha !== undefined) {
        // Android Chrome / Standard DeviceOrientation
        // In Android W3C spec: alpha is counter-clockwise rotation from North -> heading = (360 - alpha) % 360
        rawHeading = (360 - e.alpha + 360) % 360;
      }

      if (rawHeading !== null && !isNaN(rawHeading)) {
        headingTargetRef.current = rawHeading;
        setHasOrientationSensor(true);
      }
    };

    if (typeof window !== 'undefined') {
      // iOS 13+ permission support if needed
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
              window.addEventListener('deviceorientation', handleOrientation, true);
            });
        } catch {
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } else {
        // Android Absolute & Standard
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

  // Qibla Azimuth angle from True North (e.g. 294.55° for Palembang)
  const qiblaAzimuth = qiblaInfo.degrees;

  // Relative angle to turn phone from current direction:
  // When phone is at heading H:
  // relativeAngle = (qiblaAzimuth - H)
  // When relativeAngle is 0° (or phone points at qiblaAzimuth), needle points straight UP (0°).
  // Relative offset from North: (qiblaAzimuth - 360) = e.g. 294.55 - 360 = -65.45° (~ -66°)
  const relativeFromNorth = qiblaAzimuth > 180 ? qiblaAzimuth - 360 : qiblaAzimuth;

  // If sensor is active:
  // Dial rotates by -heading (so North points towards physical North)
  // Needle points towards Qibla on screen at angle: (qiblaAzimuth - displayHeading)
  const dialRotation = displayHeading !== null ? -displayHeading : 0;
  const needleRotation =
    displayHeading !== null ? (qiblaAzimuth - displayHeading + 360) % 360 : qiblaAzimuth;

  // Delta angle between phone front and Qibla (-180 to +180)
  // When phone is pointing straight to Qibla, delta is ~0°
  const deltaToQibla =
    displayHeading !== null
      ? (((qiblaAzimuth - displayHeading + 540) % 360) - 180)
      : null;

  const isAligned = deltaToQibla !== null && Math.abs(deltaToQibla) <= 3.5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        id="qibla-modal-card"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                Arah Kiblat Presisi
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Metode Hisab Spherical Falak (Ka'bah Makkah)
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Location & Distance Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{location.cityName}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Jarak ke Ka'bah</span>
              <span className="text-xs font-black text-emerald-700 font-mono">
                {qiblaInfo.distanceKm.toLocaleString('id-ID')} km
              </span>
            </div>
          </div>

          {/* Primary Precision Degree Numbers */}
          <div className="grid grid-cols-2 gap-3">
            {/* Azimuth from North */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                Sudut Kompas (Azimut)
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 mt-0.5">
                {qiblaAzimuth}°
              </div>
              <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                dari Utara Sejati (0°)
              </span>
            </div>

            {/* Deviation from North / West (e.g. -66° / 65.5° N-of-W) */}
            <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-900 block">
                Deviasi Putaran HP
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-sky-800 mt-0.5">
                {relativeFromNorth.toFixed(0)}°
              </div>
              <span className="text-[10px] text-sky-700 font-medium block mt-0.5">
                (atau ~65.5° dari Barat ke Utara)
              </span>
            </div>
          </div>

          {/* Phone Guideline Instruction Indicator */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <p className="font-bold text-amber-950">
                Cara memegang HP:
              </p>
              <p className="mt-0.5 text-amber-900 text-[11.5px]">
                Posisikan HP tidur mendatar di telapak tangan. Putar badan Anda hingga <strong>Jarum Ka'bah (Hijau Emas) tegak lurus ke atas sejajar dengan garis tengah HP</strong>.
              </p>
            </div>
          </div>

          {/* Realistic Compass Display with Phone Centerline Alignment */}
          <div className="relative flex flex-col items-center justify-center my-1 select-none">
            {/* Phone Vertical Guideline (Top notch & center line) */}
            <div className="absolute -top-3 flex flex-col items-center z-30">
              <div className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black tracking-wider uppercase border border-slate-700 shadow-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>ARAH DEPAN HP</span>
              </div>
              {/* Downward target tick */}
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900"></div>
            </div>

            {/* Compass Outer Chassis */}
            <div
              className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 relative flex items-center justify-center transition-all duration-500 shadow-xl mt-3 ${
                isAligned
                  ? 'border-emerald-500 bg-emerald-50/60 ring-8 ring-emerald-300/40 shadow-emerald-500/25 scale-102'
                  : 'border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 shadow-slate-300/60'
              }`}
            >
              {/* Center Line Crosshair of Phone (Vertical & Horizontal Guide) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-full h-[1px] bg-slate-900"></div>
                <div className="absolute h-full w-[1px] bg-slate-900"></div>
              </div>

              {/* Rotating Compass Dial (N, E, S, W) according to physical orientation */}
              <div
                className="absolute inset-2 rounded-full border border-dashed border-slate-300 flex items-center justify-center will-change-transform"
                style={{
                  transform: `rotate(${dialRotation}deg)`,
                  transition: 'transform 80ms linear',
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
                      transform: `rotate(${deg}deg) translateY(-116px)`,
                    }}
                  />
                ))}
              </div>

              {/* Qibla Pointer Needle (Kaaba Pointer) */}
              <div
                className="absolute w-full h-full flex items-center justify-center pointer-events-none will-change-transform"
                style={{
                  transform: `rotate(${needleRotation}deg)`,
                  transition: 'transform 80ms linear',
                }}
              >
                {/* Needle Arrowhead targeting Kaaba */}
                <div className="absolute top-3.5 flex flex-col items-center">
                  <div
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-md mb-1 transition-all ${
                      isAligned
                        ? 'bg-emerald-600 text-white scale-110 ring-2 ring-emerald-300'
                        : 'bg-emerald-800 text-white'
                    }`}
                  >
                    🕋 KA'BAH
                  </div>
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-emerald-600 drop-shadow-md"></div>
                </div>

                {/* Continuous Precision Needle Line */}
                <div className="w-1 h-34 bg-gradient-to-t from-transparent via-emerald-600 to-emerald-600 rounded-full"></div>
              </div>

              {/* Center Pivot */}
              <div className="relative z-20 w-11 h-11 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-amber-400 shadow-md flex items-center justify-center text-white">
                <span className="text-[10px] font-black font-mono text-amber-300">
                  {displayHeading !== null ? `${Math.round(displayHeading)}°` : 'HP'}
                </span>
              </div>
            </div>
          </div>

          {/* Real-Time Calibration Status Box */}
          {hasOrientationSensor ? (
            <div
              className={`rounded-2xl p-3.5 text-xs flex items-center gap-2.5 border transition-all ${
                isAligned
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {isAligned ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0 animate-pulse" />
              )}
              <div className="leading-snug">
                {isAligned ? (
                  <span>
                    <strong>ALHAMDULILLAH TEPAT!</strong> Garis tengah HP Anda kini sudah lurus sejajar mengarah ke Ka'bah (Deviasi {relativeFromNorth.toFixed(0)}° / Azimut {qiblaAzimuth}°).
                  </span>
                ) : (
                  <span>
                    Heading HP saat ini: <strong>{displayHeading !== null ? Math.round(displayHeading) : 0}°</strong>. Putar badan/HP Anda perlahan ke {deltaToQibla !== null && deltaToQibla > 0 ? 'kanan' : 'kiri'} sekitar <strong>{deltaToQibla !== null ? Math.abs(Math.round(deltaToQibla)) : 0}°</strong> hingga jarum Ka'bah lurus ke atas.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800 block mb-0.5">Catatan Penyelarasan Manual:</span>
              Untuk wilayah Palembang (CGC), arah kiblat adalah <strong>294.55° dari Utara Sejati</strong> atau <strong>-65.5° (~ -66°)</strong> jika dihitung dari arah Utara ke Barat. Hadapkan sajadah ke arah Barat lalu serongkan sekitar 24.5° ke kanan (arah Utara).
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Ka'bah: 21.4225° N, 39.8262° E</span>
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
