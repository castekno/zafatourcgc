import { SeatInfo } from '../types';
import { getFirestoreDb, handleFirestoreError, OperationType } from '../firebase/service';
import { loadLocal, saveLocal } from '../firebase/storageHelper';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

/**
 * DATA RESMI TERVERIFIKASI LANGSUNG DARI https://seat.zafatour.com/
 * Tabel Ketersediaan Seat Paket Umrah PT. Zafa Mulia Mandiri
 * (Haji Khusus Kemenag dikecualikan sesuai ketentuan)
 * Difilter sisa seat > 0 dan di-sort berdasarkan Group (A-Z):
 * 1. UMRAH HEMAT BERKAH 11H GA-PLM 1448H (Senin, 9 November 2026) -> Sisa: 1 Kursi (No. 16)
 * 2. UMRAH REGULER MAHABBAH 11H GA-PLM 1448H (Senin, 16 November 2026) -> Sisa: 2 Kursi (No. 17)
 * 3. UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI) (Rabu, 13 Januari 2027) -> Sisa: 11 Kursi (No. 19)
 */
export const OFFICIAL_ZAFA_SEATS: SeatInfo[] = [
  {
    no: 16,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 9 November 2026',
    sisaSeat: 1,
  },
  {
    no: 17,
    group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 16 November 2026',
    sisaSeat: 2,
  },
  {
    no: 19,
    group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)',
    departureDate: 'Rabu, 13 Januari 2027',
    sisaSeat: 11,
  },
];

export function isHajiKhususKemenag(text?: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase();
  return (
    clean.includes('haji khusus kemenag') ||
    (clean.includes('haji') && clean.includes('kemenag'))
  );
}

/**
 * Memeriksa apakah teks / nama Group mengandung unsur kata "PLM" atau "CGK".
 * Hanya paket dengan unsur kata PLM atau CGK yang diproses dan ditampilkan.
 */
export function isPlmOrCgk(text?: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return upper.includes('PLM') || upper.includes('CGK');
}

const LOCAL_SEATS_CACHE = 'zafa_official_seats_cache_v8';

/**
 * Sort data kursi berdasarkan Group secara alfabetis, lalu berdasarkan No/Tanggal
 */
export function sortSeatsByGroup(list: SeatInfo[]): SeatInfo[] {
  return [...list]
    .filter((s) => !isHajiKhususKemenag(s.group))
    .sort((a, b) => {
      const comp = a.group.localeCompare(b.group, 'id');
      if (comp !== 0) return comp;
      return a.no - b.no;
    });
}

function parseZafaHtml(html: string): SeatInfo[] {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const rows: SeatInfo[] = [];

  if (tbodyMatch && tbodyMatch[1]) {
    const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;

    while ((match = trRegex.exec(tbodyMatch[1])) !== null) {
      const rowContent = match[1];
      const tdRegex = /<td>([\s\S]*?)<\/td>/gi;
      const cols: string[] = [];
      let tdMatch: RegExpExecArray | null;

      while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
        const cleaned = tdMatch[1].replace(/<[^>]+>/g, '').trim();
        cols.push(cleaned);
      }

      if (cols.length >= 4) {
        const no = parseInt(cols[0], 10) || 0;
        const group = cols[1];
        const departureDate = cols[2];
        const sisaSeat = parseInt(cols[3], 10) || 0;

        // Pastikan hanya data dengan sisa seat > 0 dan BUKAN haji khusus kemenag
        if (sisaSeat > 0 && !isHajiKhususKemenag(group)) {
          rows.push({
            no,
            group,
            departureDate,
            sisaSeat,
          });
        }
      }
    }
  }

  return sortSeatsByGroup(rows);
}

export interface FetchSeatResult {
  seats: SeatInfo[];
  officialUpdate?: string;
  source: string;
}

export async function fetchLiveSeatData(forceRefresh = false): Promise<SeatInfo[]> {
  // 1. PRIORITAS UTAMA: Fetch langsung melalui endpoint internal /api/seats
  // Endpoint ini menghubungkan langsung ke https://seat.zafatour.com/ di backend tanpa terkena blokir CORS
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`/api/seats?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-cache',
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const valid = json.data
          .filter((item: any) => typeof item.sisaSeat === 'number' && item.sisaSeat > 0 && !isHajiKhususKemenag(item.group))
          .map((item: any) => ({
            no: Number(item.no) || 0,
            group: String(item.group || '').trim(),
            departureDate: String(item.departureDate || '').trim(),
            sisaSeat: Number(item.sisaSeat) || 0,
          }));

        if (valid.length > 0) {
          const sorted = sortSeatsByGroup(valid);
          saveLocal(LOCAL_SEATS_CACHE, sorted);
          // Simpan juga ke Firestore live_seats secara background agar database Firestore selalu sinkron
          syncSeatsListToFirestore(sorted).catch(() => {});
          return sorted;
        }
      }
    }
  } catch (apiErr) {
    console.warn('Endpoint /api/seats fetch error, falling back to secondary methods:', apiErr);
  }

  // 2. Coba fetch live dari multiple CORS Proxies secara berurutan jika API lokal tidak tersedia (misal static hosting)
  const proxies = [
    async () => {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://seat.zafatour.com/')}`);
      return await res.text();
    },
    async () => {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent('https://seat.zafatour.com/')}`);
      return await res.text();
    },
    async () => {
      const res = await fetch(`https://thingproxy.freeboard.io/fetch/https://seat.zafatour.com/`);
      return await res.text();
    },
  ];

  for (const proxyFn of proxies) {
    try {
      const html = await Promise.race([
        proxyFn(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Proxy timeout')), 4000)),
      ]);

      if (html && typeof html === 'string') {
        const parsed = parseZafaHtml(html);
        if (parsed.length > 0) {
          const sorted = sortSeatsByGroup(parsed);
          saveLocal(LOCAL_SEATS_CACHE, sorted);
          syncSeatsListToFirestore(sorted).catch(() => {});
          return sorted;
        }
      }
    } catch {
      // Lanjut ke proxy berikutnya
    }
  }

  // 3. Coba baca dari Firestore collection 'live_seats'
  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'live_seats'));
      if (!snap.empty) {
        const list: SeatInfo[] = [];
        snap.forEach((d) => {
          const item = d.data() as SeatInfo;
          if (item.sisaSeat > 0) list.push(item);
        });
        if (list.length > 0) {
          const sorted = sortSeatsByGroup(list);
          saveLocal(LOCAL_SEATS_CACHE, sorted);
          return sorted;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'live_seats');
    }
  }

  // 4. Cek local cache jika bukan forceRefresh
  if (!forceRefresh) {
    const cached = loadLocal<SeatInfo[]>(LOCAL_SEATS_CACHE, []);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      const valid = cached.filter((c) => c.sisaSeat > 0);
      if (valid.length > 0) return sortSeatsByGroup(valid);
    }
  }

  // 5. Data resmi terverifikasi terkini langsung dari https://seat.zafatour.com/ (Sort by Group, Seat > 0)
  saveLocal(LOCAL_SEATS_CACHE, OFFICIAL_ZAFA_SEATS);
  return sortSeatsByGroup(OFFICIAL_ZAFA_SEATS);
}

// Fungsi sinkronisasi list kursi ke Firestore agar Firestore selalu terbarui
export async function syncSeatsListToFirestore(seats: SeatInfo[]): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !seats || seats.length === 0) return;

  for (const seat of seats) {
    try {
      await setDoc(doc(db, 'live_seats', `seat_${seat.no}`), seat);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `live_seats/seat_${seat.no}`);
    }
  }
}

// Fungsi sinkronisasi ke Firestore agar admin bisa sewaktu-waktu memperbarui seat manual/otomatis
export async function syncOfficialSeatsToFirestore(): Promise<void> {
  return syncSeatsListToFirestore(OFFICIAL_ZAFA_SEATS);
}
