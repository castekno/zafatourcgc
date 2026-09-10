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

export interface SeatMatchResult {
  hasDateInput: boolean;
  isMatched: boolean;
  matchedSeat?: SeatInfo;
  availableSeats: SeatInfo[];
  message: string;
}

/**
 * Checks if a given departureDate matches any seat in the live seats list.
 */
export function checkSeatAvailability(
  departureDate: string,
  seats: SeatInfo[]
): SeatMatchResult {
  if (!departureDate || !departureDate.trim()) {
    return {
      hasDateInput: false,
      isMatched: false,
      availableSeats: seats.filter((s) => s.sisaSeat > 0),
      message: '',
    };
  }

  const normalizedInput = normalizeDateToISO(departureDate);
  const activeSeats = seats.filter((s) => s.sisaSeat > 0);

  const matched = activeSeats.find((seat) => {
    // 1. Direct text match
    if (seat.departureDate.toLowerCase().includes(departureDate.trim().toLowerCase())) {
      return true;
    }
    // 2. Normalized ISO match
    const normalizedSeatDate = normalizeDateToISO(seat.departureDate);
    if (normalizedInput && normalizedSeatDate && normalizedInput === normalizedSeatDate) {
      return true;
    }
    return false;
  });

  if (matched) {
    return {
      hasDateInput: true,
      isMatched: true,
      matchedSeat: matched,
      availableSeats: activeSeats,
      message: `Tersedia sisa kursi: ${matched.sisaSeat} kursi (${matched.group})`,
    };
  }

  return {
    hasDateInput: true,
    isMatched: false,
    availableSeats: activeSeats,
    message: 'Tanggal tidak ada pada jadwal seat yang tersedia',
  };
}
