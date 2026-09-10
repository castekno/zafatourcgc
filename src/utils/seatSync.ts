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
 * If title has specific keywords (e.g. 'hemat berkah', 'reguler mahabbah', 'plus turki', 'mahabbah berkah'),
 * it requires them to match the seat group.
 */
export function isTitleMatchingSeatGroup(pkgTitle: string, seatGroup: string): boolean {
  if (!pkgTitle || !seatGroup) return true; // If one is not provided yet, fallback to date match

  const pLower = pkgTitle.toLowerCase();
  const sLower = seatGroup.toLowerCase();

  // 1. Direct substring match
  if (sLower.includes(pLower) || pLower.includes(sLower)) {
    return true;
  }

  // 2. Specific Umrah package variants check
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

  // If both have explicit different package variants on the same date, they are NOT the same package!
  if (pVariant && sVariant) {
    if (pVariant !== sVariant) return false;
  }

  // 3. Token overlap check: if package title has multiple tokens, at least key identifiers must match
  const pTokens = extractSignificantTokens(pkgTitle);
  const sTokens = extractSignificantTokens(seatGroup);

  const matchedTokens = pTokens.filter((token) => sTokens.includes(token));
  // If at least 2 tokens match, or 50% of tokens match
  if (matchedTokens.length >= 2 || (pTokens.length > 0 && matchedTokens.length / pTokens.length >= 0.5)) {
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
