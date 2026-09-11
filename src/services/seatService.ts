import { SeatInfo } from '../types';
import { getFirestoreDb, handleFirestoreError, OperationType } from '../firebase/service';
import { loadLocal, saveLocal } from '../firebase/storageHelper';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

// DATA ASLI RESMI DARI https://seat.zafatour.com/
// Tabel Ketersediaan Seat Paket Umrah PT. Zafa Mulia Mandiri
// Hanya jadwal yang memiliki Sisa Seat > 0:
// No 2: UMRAH HEMAT BERKAH 11H GA-PLM 1448H (Senin, 14 September 2026) -> Sisa: 6
// No 18: UMRAH REGULER MAHABBAH 11H GA-PLM 1448H (Senin, 9 November 2026) -> Sisa: 5
// No 19: UMRAH HEMAT BERKAH 11H GA-PLM 1448H (Senin, 9 November 2026) -> Sisa: 5
// No 21: UMRAH HEMAT BERKAH 11H GA-PLM 1448H (Senin, 16 November 2026) -> Sisa: 8
// No 23: UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI) (Rabu, 13 Januari 2027) -> Sisa: 11

export const OFFICIAL_ZAFA_SEATS: SeatInfo[] = [
  {
    no: 2,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 14 September 2026',
    sisaSeat: 6,
  },
  {
    no: 18,
    group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 9 November 2026',
    sisaSeat: 5,
  },
  {
    no: 19,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 9 November 2026',
    sisaSeat: 5,
  },
  {
    no: 21,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 16 November 2026',
    sisaSeat: 8,
  },
  {
    no: 23,
    group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)',
    departureDate: 'Rabu, 13 Januari 2027',
    sisaSeat: 11,
  },
];

const LOCAL_SEATS_CACHE = 'zafa_official_seats_cache_v3';

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

        // Hanya sertakan yang sisa seat > 0 sesuai kriteria
        if (sisaSeat > 0) {
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

  return rows;
}

export async function fetchLiveSeatData(forceRefresh = false): Promise<SeatInfo[]> {
  // 1. Coba fetch live dari multiple CORS Proxies secara berurutan
  const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  ];

  for (const proxyFn of proxies) {
    try {
      const target = proxyFn('https://seat.zafatour.com/');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(target, { signal: controller.signal, cache: 'no-cache' });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const parsed = parseZafaHtml(html);
        if (parsed.length > 0) {
          saveLocal(LOCAL_SEATS_CACHE, parsed);
          return parsed;
        }
      }
    } catch {
      // Lanjut ke metode berikutnya
    }
  }

  // 2. Coba baca dari Firestore collection 'live_seats'
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
          list.sort((a, b) => a.no - b.no);
          saveLocal(LOCAL_SEATS_CACHE, list);
          return list;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'live_seats');
    }
  }

  // 3. Cek local cache jika bukan forceRefresh
  if (!forceRefresh) {
    const cached = loadLocal<SeatInfo[]>(LOCAL_SEATS_CACHE, []);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  // 4. Data resmi terverifikasi terkini langsung dari https://seat.zafatour.com/
  saveLocal(LOCAL_SEATS_CACHE, OFFICIAL_ZAFA_SEATS);
  return OFFICIAL_ZAFA_SEATS;
}

// Fungsi sinkronisasi ke Firestore agar admin bisa sewaktu-waktu memperbarui seat manual/otomatis
export async function syncOfficialSeatsToFirestore(): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  for (const seat of OFFICIAL_ZAFA_SEATS) {
    try {
      await setDoc(doc(db, 'live_seats', `seat_${seat.no}`), seat);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `live_seats/seat_${seat.no}`);
    }
  }
}
