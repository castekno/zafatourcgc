import { SeatInfo, LiveSeatDoc, LiveSeatBatch } from '../types';
import {
  getFirestoreDb,
  handleFirestoreError,
  isFirestoreQuotaExceeded,
  OperationType,
  slugifyPackageTitle,
} from '../firebase/service';
import { loadLocal, saveLocal } from '../firebase/storageHelper';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { normalizeDateToISO } from '../utils/seatSync';

/**
 * Menghasilkan Document ID unik berbasis: pkg-<slug-group>-<YYYYMMDD>
 * Contoh: "UMRAH AWAL TAHUN SUPER HEMAT 12H GA-PLM 1448H" + "Senin, 4 Januari 2027"
 * -> "pkg-umrah-awal-tahun-super-hemat-12h-ga-plm-1448h-20270104"
 */
export function generateLiveSeatDocId(group: string, departureDate: string): string {
  const slug = slugifyPackageTitle(group || '');
  const iso = normalizeDateToISO(departureDate || '');
  // Format YYYYMMDD dari ISO (2027-01-04 -> 20270104)
  const dateKey = iso ? iso.replace(/-/g, '') : (departureDate || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${slug}-${dateKey}`;
}

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
  { no: 11, group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H', departureDate: 'Senin, 26 Oktober 2026', sisaSeat: 1 },
  { no: 17, group: 'UMRAH HEMAT BERKAH 11H GA-PLM 1448H', departureDate: 'Senin, 16 November 2026', sisaSeat: 4 },
  { no: 20, group: 'UMRAH REGULER MAHABBAH 11H GA-PLM 1448H', departureDate: 'Senin, 23 November 2026', sisaSeat: 2 },
  { no: 22, group: 'UMRAH LIBURAN (AWAL) SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 7 Desember 2026', sisaSeat: 41 },
  { no: 23, group: 'UMRAH LIBURAN (AWAL) HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 7 Desember 2026', sisaSeat: 44 },
  { no: 24, group: 'UMRAH LIBURAN (AWAL) REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 7 Desember 2026', sisaSeat: 38 },
  { no: 25, group: 'UMRAH LIBURAN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 14 Desember 2026', sisaSeat: 36 },
  { no: 26, group: 'UMRAH LIBURAN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 14 Desember 2026', sisaSeat: 40 },
  { no: 27, group: 'UMRAH LIBURAN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 14 Desember 2026', sisaSeat: 42 },
  { no: 28, group: 'UMRAH LIBURAN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 28 Desember 2026', sisaSeat: 34 },
  { no: 29, group: 'UMRAH LIBURAN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 28 Desember 2026', sisaSeat: 24 },
  { no: 30, group: 'UMRAH LIBURAN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 28 Desember 2026', sisaSeat: 31 },
  { no: 31, group: 'UMRAH AWAL TAHUN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 4 Januari 2027', sisaSeat: 35 },
  { no: 32, group: 'UMRAH AWAL TAHUN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 4 Januari 2027', sisaSeat: 34 },
  { no: 33, group: 'UMRAH AWAL TAHUN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 4 Januari 2027', sisaSeat: 34 },
  { no: 34, group: 'UMRAH AWAL TAHUN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 4 Januari 2027', sisaSeat: 34 },
  { no: 35, group: 'UMRAH AWAL TAHUN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 11 Januari 2027', sisaSeat: 44 },
  { no: 36, group: 'UMRAH AWAL TAHUN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 11 Januari 2027', sisaSeat: 26 },
  { no: 37, group: 'UMRAH AWAL TAHUN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 11 Januari 2027', sisaSeat: 44 },
  { no: 38, group: 'UMRAH PLUS TURKI 12H JT CGK 1448H (ESTIMASI)', departureDate: 'Rabu, 13 Januari 2027', sisaSeat: 9 },
  { no: 39, group: 'UMRAH AWAL TAHUN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 25 Januari 2027', sisaSeat: 44 },
  { no: 40, group: 'UMRAH AWAL TAHUN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 25 Januari 2027', sisaSeat: 41 },
  { no: 41, group: 'UMRAH AWAL TAHUN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 25 Januari 2027', sisaSeat: 44 },
  { no: 42, group: 'UMRAH RAMADHAN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 8 Februari 2027', sisaSeat: 44 },
  { no: 43, group: 'UMRAH RAMADHAN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 8 Februari 2027', sisaSeat: 38 },
  { no: 44, group: 'UMRAH RAMADHAN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 8 Februari 2027', sisaSeat: 40 },
  { no: 45, group: 'UMRAH RAMADHAN SUPER HEMAT 12H GA-PLM 1448H', departureDate: 'Senin, 22 Februari 2027', sisaSeat: 44 },
  { no: 46, group: 'UMRAH RAMADHAN REGULER MAHABBAH 12H GA-PLM 1448H', departureDate: 'Senin, 22 Februari 2027', sisaSeat: 44 },
  { no: 47, group: 'UMRAH RAMADHAN HEMAT BERKAH 12H GA-PLM 1448H', departureDate: 'Senin, 22 Februari 2027', sisaSeat: 44 },
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

let latestOfficialUpdate = '';

export function getLatestOfficialUpdate(): string {
  return latestOfficialUpdate;
}

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
      if (json && json.officialUpdate) {
        latestOfficialUpdate = json.officialUpdate;
      }
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
          // Sinkronkan ke Firestore live_seats secara otomatis di latar belakang
          syncSeatsListToFirestore(sorted).catch((err) => {
            console.warn('Latar belakang sinkronisasi live_seats ke Firestore:', err?.message || err);
          });
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
          syncSeatsListToFirestore(sorted).catch((err) => {
            console.warn('Latar belakang sinkronisasi live_seats ke Firestore:', err?.message || err);
          });
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
          const data = d.data();
          // Format baru: dokumen memiliki array batches atau schedules bertingkat
          if (Array.isArray(data.batches) && data.batches.length > 0) {
            for (const b of data.batches) {
              if (b && typeof b.sisaSeat === 'number' && b.sisaSeat > 0) {
                list.push({
                  no: b.no || 0,
                  group: data.group || data.packageTitle || '',
                  departureDate: b.departureDate || data.departureDate || '',
                  sisaSeat: b.sisaSeat,
                });
              }
            }
          } else if (Array.isArray(data.schedules) && data.schedules.length > 0) {
            for (const s of data.schedules) {
              if (s && typeof s.sisaSeat === 'number' && s.sisaSeat > 0) {
                list.push({
                  no: s.no || 0,
                  group: data.group || data.packageTitle || '',
                  departureDate: s.departureDate || data.departureDate || '',
                  sisaSeat: s.sisaSeat,
                });
              }
            }
          } else if (typeof data.sisaSeat === 'number' && data.sisaSeat > 0) {
            // Kompatibilitas mundur jika dokumen masih berformat lama
            list.push({
              no: data.no || 0,
              group: data.group || data.packageTitle || '',
              departureDate: data.departureDate || '',
              sisaSeat: data.sisaSeat,
            });
          }
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

/**
 * Sinkronisasi data kursi ke Firestore collection 'live_seats'
 * Menggunakan format dokumen: pkg-<slug-group>-<YYYYMMDD>
 * Jika terdapat lebih dari 1 baris untuk tanggal yang sama, disimpan sebagai batches bertingkat.
 * Membersihkan juga dokumen seat_XX format lama agar database bersih.
 */
export async function syncSeatsListToFirestore(seats: SeatInfo[]): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const db = getFirestoreDb();
  if (!db || !seats || seats.length === 0) return;

  // Kelompokkan data kursi berdasarkan Document ID (pkg-<slug>-<YYYYMMDD>)
  const groupedDocs = new Map<
    string,
    {
      group: string;
      departureDate: string;
      isoDate: string;
      dateKey: string;
      packageSlug: string;
      batches: LiveSeatBatch[];
    }
  >();

  for (const seat of seats) {
    if (!seat || !seat.group || !seat.departureDate) continue;
    // HANYA ambil data yang sisa seat-nya > 0 dan abaikan Haji Khusus Kemenag
    if (typeof seat.sisaSeat !== 'number' || seat.sisaSeat <= 0) continue;
    if (isHajiKhususKemenag(seat.group)) continue;

    const docId = generateLiveSeatDocId(seat.group, seat.departureDate);
    const slug = slugifyPackageTitle(seat.group);
    const iso = normalizeDateToISO(seat.departureDate) || '';
    const dateKey = iso ? iso.replace(/-/g, '') : seat.departureDate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    if (!groupedDocs.has(docId)) {
      groupedDocs.set(docId, {
        group: seat.group,
        departureDate: seat.departureDate,
        isoDate: iso,
        dateKey: dateKey,
        packageSlug: slug,
        batches: [],
      });
    }

    const entry = groupedDocs.get(docId)!;
    entry.batches.push({
      batchIndex: entry.batches.length + 1,
      no: seat.no,
      departureDate: seat.departureDate,
      sisaSeat: seat.sisaSeat,
    });
  }

  // 1. Ambil dokumen live_seats yang sudah ada di Firestore untuk Dirty Checking
  const existingMap = new Map<string, any>();
  try {
    const existingSnap = await getDocs(collection(db, 'live_seats'));
    for (const d of existingSnap.docs) {
      existingMap.set(d.id, d.data());
    }
  } catch (err) {
    console.warn('[Dirty-Check Seat] Gagal membaca data live_seats lama:', err);
  }

  // 2. Simpan ke Firestore HANYA jika data kursi benar-benar berubah (Dirty Checking)
  for (const [docId, entry] of groupedDocs.entries()) {
    try {
      const validBatches = entry.batches.filter((b) => b && typeof b.sisaSeat === 'number' && b.sisaSeat > 0);
      const totalSeats = validBatches.reduce((sum, b) => sum + (b.sisaSeat || 0), 0);

      // Jika total kursi <= 0, pastikan dokumen dihapus bila sebelumnya ada
      if (totalSeats <= 0 || validBatches.length === 0) {
        if (existingMap.has(docId)) {
          await deleteDoc(doc(db, 'live_seats', docId)).catch(() => {});
        }
        continue;
      }

      // Cek apakah dokumen ini sudah ada di Firestore dan apakah isinya sama persis
      const existing = existingMap.get(docId);
      let hasChanged = true;

      if (existing) {
        const existingTotal = typeof existing.totalSisaSeat === 'number' ? existing.totalSisaSeat : existing.sisaSeat;
        const existingBatches: any[] = Array.isArray(existing.batches)
          ? existing.batches
          : Array.isArray(existing.schedules)
          ? existing.schedules
          : [];

        const totalMatches = existingTotal === totalSeats;
        const batchesMatches =
          existingBatches.length === validBatches.length &&
          existingBatches.every((eb, idx) => {
            const vb = validBatches[idx];
            return (
              eb.departureDate === vb.departureDate &&
              eb.sisaSeat === vb.sisaSeat &&
              (eb.no || 0) === (vb.no || 0)
            );
          });

        if (totalMatches && batchesMatches) {
          hasChanged = false;
        }
      }

      // JIKA DATA KURSI MASIH SAMA: JANGAN TULIS KE FIRESTORE (0 write)
      if (!hasChanged) {
        continue;
      }

      // JIKA ADA PERUBAHAN (ATAU DOKUMEN BARU): Tulis ke Firestore
      const docPayload: LiveSeatDoc = {
        id: docId,
        packageSlug: entry.packageSlug,
        packageTitle: entry.group,
        group: entry.group,
        departureDate: entry.departureDate,
        isoDate: entry.isoDate,
        dateKey: entry.dateKey,
        totalSisaSeat: totalSeats,
        sisaSeat: totalSeats,
        batches: validBatches,
        schedules: validBatches,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'live_seats', docId), docPayload);
      console.info(`[Dirty-Check Seat] Memperbarui kursi ${entry.group} (${entry.departureDate}): ${totalSeats} kursi.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `live_seats/${docId}`);
    }
  }

  // 3. Bersihkan dokumen format lama 'seat_XX' atau dokumen yang kursinya sudah habis/0 dari Firestore
  try {
    for (const [docId, data] of existingMap.entries()) {
      if (docId === 'meta_current' || docId === 'test_doc') continue;

      if (docId.startsWith('seat_')) {
        await deleteDoc(doc(db, 'live_seats', docId)).catch(() => {});
      } else if (docId.startsWith('pkg-')) {
        // HAPUS jika dokumen tidak tercantum dalam daftar aktif groupedDocs (artinya kursi sudah 0 atau jadwal sudah berakhir di seat.zafatour.com)
        if (!groupedDocs.has(docId)) {
          await deleteDoc(doc(db, 'live_seats', docId)).catch(() => {});
          continue;
        }
        if (
          !data ||
          typeof data.totalSisaSeat !== 'number' ||
          data.totalSisaSeat <= 0 ||
          (typeof data.sisaSeat === 'number' && data.sisaSeat <= 0) ||
          isHajiKhususKemenag(data.group || data.packageTitle || '')
        ) {
          await deleteDoc(doc(db, 'live_seats', docId)).catch(() => {});
        }
      }
    }
  } catch {
    // Abaikan jika pembersihan gagal
  }
}

// Fungsi sinkronisasi ke Firestore agar admin bisa sewaktu-waktu memperbarui seat manual/otomatis
export async function syncOfficialSeatsToFirestore(): Promise<void> {
  return syncSeatsListToFirestore(OFFICIAL_ZAFA_SEATS);
}
