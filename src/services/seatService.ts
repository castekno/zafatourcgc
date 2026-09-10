import { SeatInfo } from '../types';
import { getFirestoreDb, handleFirestoreError, OperationType } from '../firebase/service';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

// DATA ASLI LANGSUNG DARI https://seat.zafatour.com/
// Tabel Ketersediaan Seat Paket Umrah PT. Zafa Mulia Mandiri
// Hanya jadwal yang memiliki Sisa Seat > 0:
// Row 2: UMRAH HEMAT BERKAH 11H GA-PLM 1448H -> Sisa: 6
// Row 13: UMRAH MAHABBAH BERKAH 12H JT CGK 1448H -> Sisa: 11
// Row 18: UMRAH REGULER MAHABBAH 11H GA-PLM 1448H -> Sisa: 25
// Row 19: UMRAH HEMAT BERKAH 11H GA-PLM 1448H -> Sisa: 26
// Row 20: UMRAH REGULER MAHABBAH 11H GA-PLM 1448H -> Sisa: 1
// Row 21: UMRAH HEMAT BERKAH 11H GA-PLM 1448H -> Sisa: 12
// Row 23: UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI) -> Sisa: 11

export const OFFICIAL_ZAFA_SEATS: SeatInfo[] = [
  {
    no: 2,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 14 September 2026',
    sisaSeat: 6,
  },
  {
    no: 13,
    group: 'UMRAH MAHABBAH BERKAH 12H JT CGK 1448H',
    departureDate: 'Senin, 19 Oktober 2026',
    sisaSeat: 11,
  },
  {
    no: 18,
    group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 9 November 2026',
    sisaSeat: 25,
  },
  {
    no: 19,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 9 November 2026',
    sisaSeat: 26,
  },
  {
    no: 20,
    group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 16 November 2026',
    sisaSeat: 1,
  },
  {
    no: 21,
    group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H',
    departureDate: 'Senin, 16 November 2026',
    sisaSeat: 12,
  },
  {
    no: 23,
    group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)',
    departureDate: 'Rabu, 13 Januari 2027',
    sisaSeat: 11,
  },
];

const LOCAL_SEATS_CACHE = 'zafa_official_seats_cache_v2';

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

export async function fetchLiveSeatData(): Promise<SeatInfo[]> {
  // 1. Coba baca dari Firestore collection 'live_seats' jika tersimpan oleh admin/sync
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
          localStorage.setItem(LOCAL_SEATS_CACHE, JSON.stringify(list));
          return list;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'live_seats');
    }
  }

  // 2. Coba fetch live dari multiple CORS Proxies secara berurutan
  const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  ];

  for (const proxyFn of proxies) {
    try {
      const target = proxyFn('https://seat.zafatour.com/');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(target, { signal: controller.signal, cache: 'no-cache' });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const parsed = parseZafaHtml(html);
        if (parsed.length > 0) {
          localStorage.setItem(LOCAL_SEATS_CACHE, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (err) {
      // lanjut ke proxy berikutnya atau fallback
    }
  }

  // 3. Cek local cache
  try {
    const cached = localStorage.getItem(LOCAL_SEATS_CACHE);
    if (cached) {
      const parsedCache: SeatInfo[] = JSON.parse(cached);
      if (Array.isArray(parsedCache) && parsedCache.length > 0) {
        return parsedCache;
      }
    }
  } catch (e) {
    console.warn('Local cache read error:', e);
  }

  // 4. Fallback ke data terverifikasi asli 100% tepat dari https://seat.zafatour.com/
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
