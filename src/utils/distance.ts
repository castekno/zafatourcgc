import { KAABA_COORDS, NABAWI_COORDS } from '../data/constants';

/**
 * Calculates distance in meters between two lat/lng coordinates using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Extracts latitude and longitude from standard Google Maps URLs
 */
export function extractCoordsFromMapUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;

  // Format 1: @21.4225,39.8262
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Format 2: ?q=21.4225,39.8262 or &q=21.4225,39.8262
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // Format 3: ll=21.4225,39.8262
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) {
    return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  }

  return null;
}

/**
 * Calculates distance to Kaaba in Makkah from hotel Google Maps URL or fallback distance
 */
export function getDistanceToKaaba(mapUrl?: string, manualMeters?: number): string {
  if (manualMeters && manualMeters > 0) {
    return manualMeters < 1000
      ? `~${manualMeters} m ke Ka'bah`
      : `~${(manualMeters / 1000).toFixed(1)} km ke Ka'bah`;
  }

  if (mapUrl) {
    const coords = extractCoordsFromMapUrl(mapUrl);
    if (coords) {
      const dist = calculateHaversineDistance(
        coords.lat,
        coords.lng,
        KAABA_COORDS.lat,
        KAABA_COORDS.lng
      );
      return dist < 1000 ? `~${dist} m ke Ka'bah` : `~${(dist / 1000).toFixed(1)} km ke Ka'bah`;
    }
  }

  return 'Dalam radius halaman Masjidil Haram';
}

/**
 * Calculates distance to Prophet's Mosque in Madinah from hotel Google Maps URL or fallback distance
 */
export function getDistanceToNabawi(mapUrl?: string, manualMeters?: number): string {
  if (manualMeters && manualMeters > 0) {
    return manualMeters < 1000
      ? `~${manualMeters} m ke Masjid Nabawi`
      : `~${(manualMeters / 1000).toFixed(1)} km ke Masjid Nabawi`;
  }

  if (mapUrl) {
    const coords = extractCoordsFromMapUrl(mapUrl);
    if (coords) {
      const dist = calculateHaversineDistance(
        coords.lat,
        coords.lng,
        NABAWI_COORDS.lat,
        NABAWI_COORDS.lng
      );
      return dist < 1000
        ? `~${dist} m ke Masjid Nabawi`
        : `~${(dist / 1000).toFixed(1)} km ke Masjid Nabawi`;
    }
  }

  return 'Dekat pelataran Masjid Nabawi';
}

export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
