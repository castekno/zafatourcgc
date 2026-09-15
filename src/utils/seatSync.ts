import { SeatInfo } from '../types';

const INDONESIAN_MONTHS: Record<string, string> = {
  januari: '01',
  februari: '02',
  maret: '03',
  april: '04',
  mei: '05',
  juni: '06',
  juli: '07',
  agustus: '08',
  september: '09',
  oktober: '10',
  november: '11',
  desember: '12',
};

/**
 * Normalizes any date string (ISO YYYY-MM-DD or Indonesian "Senin, 5 Oktober 2026")
 * into a standard ISO format "YYYY-MM-DD" for comparison.
 */
export function normalizeDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // If already standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Indonesian format like "Senin, 5 Oktober 2026" or "5 Oktober 2026"
  const clean = trimmed.replace(/^[A-Za-z]+,\s*/, '').trim().toLowerCase();
  const parts = clean.split(/\s+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const monthName = parts[1];
    const year = parts[2];
    const month = INDONESIAN_MONTHS[monthName];
    if (month && year && day) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback try standard JS Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Normalizes package title / group name into clean token set for flexible fuzzy matching.
 * e.g., "UMRAH REGULER MAHABBAH 11H (Direct GA PLM)" -> tokens ['umrah', 'reguler', 'mahabbah', '11h', 'ga', 'plm']
 */
export function extractSignificantTokens(text: string): string[] {
  if (!text) return [];
  // Remove non-alphanumeric chars, split by whitespace
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  // Filter out very common noise if any
  return words.filter((w) => !['pt', 'paket', 'keberangkatan', 'group', 'pilihan'].includes(w));
}

/**
 * Checks if package title and seat group name refer to the same package category/variant.
 * Prevents cross-contamination between different packages that share generic words like "REGULER MAHABBAH"
 * but have different durations (e.g. 11H vs 13H), airports (PLM vs PDG), or airlines (GA vs OD).
 */
export function isTitleMatchingSeatGroup(pkgTitle: string, seatGroup: string): boolean {
  if (!pkgTitle || !seatGroup) return false;

  const pLower = pkgTitle.toLowerCase().trim();
  const sLower = seatGroup.toLowerCase().trim();

  // If exact match
  if (pLower === sLower) return true;

  // Never match Haji Khusus Kemenag
  if (
    pLower.includes('haji khusus kemenag') ||
    (pLower.includes('haji') && pLower.includes('kemenag')) ||
    sLower.includes('haji khusus kemenag') ||
    (sLower.includes('haji') && sLower.includes('kemenag'))
  ) {
    return false;
  }

  // 1. Duration check: e.g. 11H vs 13H
  const pDurMatch = pLower.match(/\b(\d+)\s*h\b/);
  const sDurMatch = sLower.match(/\b(\d+)\s*h\b/);
  if (pDurMatch && sDurMatch && pDurMatch[1] !== sDurMatch[1]) {
    return false; // Berbeda durasi hari (misal 11H vs 13H) -> BUKAN PAKET YANG SAMA
  }

  // 2. Airport route check: e.g. PLM vs PDG vs CGK
  const airports = ['plm', 'pdg', 'cgk', 'sub', 'kno'];
  const pAir = airports.find((a) => pLower.includes(a));
  const sAir = airports.find((a) => sLower.includes(a));
  if (pAir && sAir && pAir !== sAir) {
    return false; // Berbeda bandara (misal PLM vs PDG) -> BUKAN PAKET YANG SAMA
  }

  // 3. Airline code check: e.g. GA vs OD vs JT
  const airlines = ['ga', 'od', 'jt', 'sv'];
  const pLine = airlines.find((l) => new RegExp(`\\b${l}\\b`).test(pLower));
  const sLine = airlines.find((l) => new RegExp(`\\b${l}\\b`).test(sLower));
  if (pLine && sLine && pLine !== sLine) {
    return false; // Berbeda maskapai -> BUKAN PAKET YANG SAMA
  }

  // 4. Specific package variants check
  const variants = [
    { key: 'plus turki', label: 'Plus Turki' },
    { key: 'super hemat', label: 'Super Hemat' },
    { key: 'hemat berkah', label: 'Hemat Berkah' },
    { key: 'reguler mahabbah', label: 'Reguler Mahabbah' },
    { key: 'mahabbah berkah', label: 'Mahabbah Berkah' },
    { key: 'haji khusus', label: 'Haji Khusus' },
  ];

  let pVariant = '';
  let sVariant = '';

  for (const v of variants) {
    if (!pVariant && pLower.includes(v.key)) {
      pVariant = v.key;
    }
    if (!sVariant && sLower.includes(v.key)) {
      sVariant = v.key;
    }
  }

  if (pVariant && sVariant && pVariant !== sVariant) {
    return false;
  }

  // If one string directly contains the other
  if (sLower.includes(pLower) || pLower.includes(sLower)) {
    return true;
  }

  return false;
}

/**
 * Checks if two date representations point to the same date.
 */
export function isDateMatching(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const cleanA = dateA.trim().toLowerCase();
  const cleanB = dateB.trim().toLowerCase();

  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  const isoA = normalizeDateToISO(dateA);
  const isoB = normalizeDateToISO(dateB);
  if (isoA && isoB && isoA === isoB) return true;

  return false;
}

export interface SeatMatchResult {
  hasDateInput: boolean;
  hasTitleInput: boolean;
  isMatched: boolean;
  matchedSeat?: SeatInfo;
  availableSeats: SeatInfo[];
  message: string;
}

/**
 * Synchronizes and checks seat availability by matching:
 * Nama Paket + Tanggal Berangkat di Data Paket
 * dengan
 * Nama Group / Paket Umroh + Tanggal Berangkat di Data seat.
 */
export function checkPackageAndSeatAvailability(
  pkgTitle: string,
  departureDate: string,
  seats: SeatInfo[]
): SeatMatchResult {
  const activeSeats = seats.filter((s) => s.sisaSeat > 0);

  if (!departureDate || !departureDate.trim()) {
    return {
      hasDateInput: false,
      hasTitleInput: Boolean(pkgTitle && pkgTitle.trim()),
      isMatched: false,
      availableSeats: activeSeats,
      message: 'Pilih atau masukkan tanggal berangkat',
    };
  }

  // Find seat where both date matches AND title/group matches
  const matched = activeSeats.find((seat) => {
    const dateMatch = isDateMatching(departureDate, seat.departureDate);
    if (!dateMatch) return false;

    // If package title is entered, also verify Nama Paket matches Nama Group
    if (pkgTitle && pkgTitle.trim()) {
      return isTitleMatchingSeatGroup(pkgTitle, seat.group);
    }

    return true;
  });

  if (matched) {
    return {
      hasDateInput: true,
      hasTitleInput: Boolean(pkgTitle && pkgTitle.trim()),
      isMatched: true,
      matchedSeat: matched,
      availableSeats: activeSeats,
      message: `Tersedia sisa kursi: ${matched.sisaSeat} kursi (${matched.group})`,
    };
  }

  // If date matched but title didn't match (e.g. tanggal sama namun nama paket berbeda)
  const dateOnlyMatches = activeSeats.filter((seat) =>
    isDateMatching(departureDate, seat.departureDate)
  );

  if (dateOnlyMatches.length > 0 && pkgTitle && pkgTitle.trim()) {
    const otherGroups = dateOnlyMatches.map((s) => `"${s.group}" (${s.sisaSeat} kursi)`).join(', ');
    return {
      hasDateInput: true,
      hasTitleInput: true,
      isMatched: false,
      availableSeats: activeSeats,
      message: `Tanggal ${departureDate} tersedia untuk group lain: ${otherGroups}, tetapi nama paket "${pkgTitle}" tidak sesuai atau kursi habis.`,
    };
  }

  return {
    hasDateInput: true,
    hasTitleInput: Boolean(pkgTitle && pkgTitle.trim()),
    isMatched: false,
    availableSeats: activeSeats,
    message: 'Tanggal tidak ada pada jadwal seat yang tersedia',
  };
}

// Legacy alias for compatibility
export const checkSeatAvailability = (date: string, seats: SeatInfo[]) =>
  checkPackageAndSeatAvailability('', date, seats);
