import { Coordinates, CalculationMethod, PrayerTimes, Madhab, Qibla } from 'adhan';
import {
  PrayerName,
  PrayerTimeSlot,
  UserLocationInfo,
  PrayerCountdownInfo,
} from '../types';
import { getFirestoreDb } from '../firebase/service';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Default Location: CitraGrand City Palembang (ZafaTour CGC)
export const DEFAULT_LOCATION: UserLocationInfo = {
  latitude: -2.9348,
  longitude: 104.7082,
  cityName: 'Palembang',
  districtName: 'CitraGrand City / Alang-Alang Lebar',
  source: 'fallback',
  updatedAt: new Date().toISOString(),
};

const LOCATION_STORAGE_KEY = 'zafa_user_location_cache';

/**
 * Format Date to HH:mm (24-hour)
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Approximate City Name from Coordinates (Offline Fast Lookup)
 */
export function approximateCityFromCoords(lat: number, lng: number): { city: string; district?: string } {
  // Palembang area (-2.8 to -3.1, 104.5 to 105.0)
  if (lat >= -3.2 && lat <= -2.7 && lng >= 104.5 && lng <= 105.1) {
    return { city: 'Palembang', district: 'Sumatera Selatan' };
  }
  // Jakarta / Jabodetabek area (-6.4 to -6.0, 106.6 to 107.1)
  if (lat >= -6.5 && lat <= -6.0 && lng >= 106.6 && lng <= 107.1) {
    return { city: 'Jakarta', district: 'DKI Jakarta' };
  }
  // Surabaya (-7.4 to -7.1, 112.6 to 112.9)
  if (lat >= -7.4 && lat <= -7.1 && lng >= 112.6 && lng <= 112.9) {
    return { city: 'Surabaya', district: 'Jawa Timur' };
  }
  // Medan (3.4 to 3.8, 98.5 to 98.8)
  if (lat >= 3.4 && lat <= 3.8 && lng >= 98.5 && lng <= 98.8) {
    return { city: 'Medan', district: 'Sumatera Utara' };
  }
  // Makkah (21.2 to 21.6, 39.7 to 40.0)
  if (lat >= 21.2 && lat <= 21.6 && lng >= 39.6 && lng <= 40.0) {
    return { city: 'Makkah Al-Mukarramah', district: 'Arab Saudi' };
  }
  // Madinah (24.3 to 24.6, 39.5 to 39.8)
  if (lat >= 24.3 && lat <= 24.6 && lng >= 39.4 && lng <= 39.8) {
    return { city: 'Madinah Al-Munawwarah', district: 'Arab Saudi' };
  }
  // Generic Indonesia
  if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
    return { city: 'Indonesia', district: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°` };
  }
  return { city: 'Lokasi Pengguna', district: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°` };
}

/**
 * Reverse geocode coordinates to human-readable city & district
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; district?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const city =
        data.city ||
        data.locality ||
        data.principalSubdivision ||
        approximateCityFromCoords(lat, lng).city;
      const district =
        data.locality && data.locality !== city
          ? data.locality
          : data.principalSubdivision || '';
      return { city, district };
    }
  } catch {
    // Fallback silently to offline lookup
  }
  return approximateCityFromCoords(lat, lng);
}

/**
 * Get Saved Location from Local Storage or Firestore
 */
export async function getSavedLocation(): Promise<UserLocationInfo> {
  try {
    const cached = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.latitude && parsed.longitude) {
        return parsed;
      }
    }

    // Try fetching from Firestore if available
    const db = getFirestoreDb();
    if (db) {
      const snap = await getDoc(doc(db, 'prayer_settings', 'latest_location'));
      if (snap.exists()) {
        const data = snap.data() as UserLocationInfo;
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('Error reading saved location:', err);
  }

  return DEFAULT_LOCATION;
}

/**
 * Save Location to LocalStorage and Firestore
 */
export async function saveLocation(location: UserLocationInfo): Promise<void> {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));

    const db = getFirestoreDb();
    if (db) {
      await setDoc(doc(db, 'prayer_settings', 'latest_location'), {
        ...location,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Could not persist location to Firestore:', err);
  }
}

/**
 * Request Geolocation from Browser automatically
 */
export function requestCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation tidak didukung oleh perangkat ini.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000, // 10 minutes cache
      }
    );
  });
}

/**
 * Calculate Prayer Times for a given coordinates and date
 */
export function calculatePrayerTimes(
  coords: { latitude: number; longitude: number },
  targetDate: Date = new Date()
): {
  slots: PrayerTimeSlot[];
  raw: PrayerTimes;
  imsakDate: Date;
} {
  const adhanCoords = new Coordinates(coords.latitude, coords.longitude);

  // Method Selection:
  // If in Saudi Arabia (Makkah/Madinah), use UmmAlQura
  // Otherwise for Indonesia/Southeast Asia, use Singapore (Fajr 20°, Isha 18° -> Kemenag RI standard)
  const isSaudi =
    coords.latitude >= 16 &&
    coords.latitude <= 32 &&
    coords.longitude >= 34 &&
    coords.longitude <= 55;

  const params = isSaudi
    ? CalculationMethod.UmmAlQura()
    : CalculationMethod.Singapore();

  params.madhab = Madhab.Shafi;

  const pt = new PrayerTimes(adhanCoords, targetDate, params);

  // Imsak is standard 10 minutes before Subuh (Fajr) in Kemenag
  const imsakDate = new Date(pt.fajr.getTime() - 10 * 60 * 1000);

  const now = new Date();

  const rawSlots: { name: PrayerName; dateObj: Date }[] = [
    { name: 'Imsak', dateObj: imsakDate },
    { name: 'Subuh', dateObj: pt.fajr },
    { name: 'Terbit', dateObj: pt.sunrise },
    { name: 'Dzuhur', dateObj: pt.dhuhr },
    { name: 'Ashar', dateObj: pt.asr },
    { name: 'Maghrib', dateObj: pt.maghrib },
    { name: 'Isya', dateObj: pt.isha },
  ];

  // Determine next and current prayer
  let nextFound = false;
  const slots: PrayerTimeSlot[] = rawSlots.map((slot) => {
    const passed = now.getTime() >= slot.dateObj.getTime();
    let isNext = false;
    if (!passed && !nextFound) {
      isNext = true;
      nextFound = true;
    }

    return {
      name: slot.name,
      timeString: formatTime(slot.dateObj),
      dateObj: slot.dateObj,
      isNext,
      isCurrent: false, // Calculated subsequently
      passed,
    };
  });

  // Highlight current prayer period
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].passed) {
      slots[i].isCurrent = true;
      break;
    }
  }

  return { slots, raw: pt, imsakDate };
}

/**
 * Calculate Countdown to the Next Prayer
 */
export function getNextPrayerCountdown(
  coords: { latitude: number; longitude: number },
  now: Date = new Date()
): PrayerCountdownInfo {
  const todayTimes = calculatePrayerTimes(coords, now);
  const nowMs = now.getTime();

  // Find next prayer today
  for (const slot of todayTimes.slots) {
    const diffMs = slot.dateObj.getTime() - nowMs;
    if (diffMs > 0) {
      return formatCountdown(slot.name, slot.timeString, diffMs);
    }
  }

  // If all prayers today have passed, the next prayer is tomorrow's Imsak
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTimes = calculatePrayerTimes(coords, tomorrow);
  const firstTomorrow = tomorrowTimes.slots[0]; // Imsak
  const diffMs = firstTomorrow.dateObj.getTime() - nowMs;

  return formatCountdown(firstTomorrow.name, firstTomorrow.timeString, diffMs);
}

function formatCountdown(
  prayerName: PrayerName,
  timeStr: string,
  diffMs: number
): PrayerCountdownInfo {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return {
    nextPrayerName: prayerName,
    nextPrayerTimeStr: timeStr,
    timeRemainingStr: `${hh}:${mm}:${ss}`,
    totalSecondsRemaining: totalSeconds,
  };
}

/**
 * Calculate Precise Qibla Angle from Coordinates
 * Coordinates of Kaaba, Makkah: 21.4225° N, 39.8262° E
 */
export interface QiblaInfo {
  degrees: number; // e.g. 294.55° from True North
  cardinalDirection: string; // e.g. "Barat Laut (WNW)"
  distanceKm: number; // approximate spherical distance in km
  makkahCoords: { latitude: number; longitude: number };
}

export function calculateQiblaInfo(coords: { latitude: number; longitude: number }): QiblaInfo {
  const adhanCoords = new Coordinates(coords.latitude, coords.longitude);
  const degrees = Qibla(adhanCoords);

  // Haversine formula for distance to Kaaba (21.4225, 39.8262)
  const makkahLat = 21.4225;
  const makkahLng = 39.8262;

  const R = 6371; // Earth radius in km
  const dLat = ((makkahLat - coords.latitude) * Math.PI) / 180;
  const dLon = ((makkahLng - coords.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coords.latitude * Math.PI) / 180) *
      Math.cos((makkahLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c);

  // Compass description relative to True North
  let cardinal = 'Barat Laut';
  if (degrees >= 270 && degrees <= 315) {
    cardinal = 'Barat - Barat Laut';
  } else if (degrees > 315 && degrees <= 360) {
    cardinal = 'Barat Laut - Utara';
  } else if (degrees >= 225 && degrees < 270) {
    cardinal = 'Barat Daya - Barat';
  }

  return {
    degrees: Number(degrees.toFixed(2)),
    cardinalDirection: cardinal,
    distanceKm,
    makkahCoords: { latitude: makkahLat, longitude: makkahLng },
  };
}

