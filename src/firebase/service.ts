import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDocFromServer,
} from 'firebase/firestore';
import {
  Hotel,
  UmrahPackage,
  DocumentationItem,
  AppSettings,
  SeatInfo,
  SeatSchedule,
  PackageCategoryType,
} from '../types';
import {
  INITIAL_HOTELS,
  INITIAL_PACKAGES,
  INITIAL_DOCUMENTATION,
  DEFAULT_ZAFA_LOGO,
  WHATSAPP_NUMBER,
} from '../data/constants';
import { loadLocal, saveLocal } from './storageHelper';
import { normalizeDateToISO } from '../utils/seatSync';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_PROJECT_INFO = {
  projectName: 'zafatourcgc',
  projectId: firebaseConfig.projectId || 'zafatourcgc-e4b5f',
  projectNumber: firebaseConfig.messagingSenderId || '470014128791',
  messagingSenderId: firebaseConfig.messagingSenderId || '470014128791',
  firestoreDatabaseName: firebaseConfig.firestoreDatabaseId || 'dbzafatourcgc',
};

// Error handling types required by Firebase Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota =
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('Free daily write units') ||
    (error as any)?.code === 'resource-exhausted';

  if (isQuota) {
    quotaExceededState = true;
    console.warn(
      `[Firestore Quota Protection] Batas kuota tulis Firestore harian tercapai untuk operasi ${operationType} pada ${path}. Aplikasi otomatis menggunakan penyimpanan lokal (LocalStorage cache) agar web tetap beroperasi dengan lancar.`
    );
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info:', JSON.stringify(errInfo));
}

// Global flag to prevent continuous failing writes when Firebase free quota is reached
let quotaExceededState = false;

export class FirestoreQuotaExceededError extends Error {
  constructor(message?: string) {
    super(
      message ||
        'Batas kuota tulis harian Firebase (Free Tier) telah tercapai. Operasi dibatalkan demi menjaga konsistensi database.'
    );
    this.name = 'FirestoreQuotaExceededError';
  }
}

export function isFirestoreQuotaExceeded(): boolean {
  return quotaExceededState;
}

export function setFirestoreQuotaExceeded(val: boolean = true) {
  quotaExceededState = val;
}

function checkQuotaExceeded(operationName: string) {
  if (quotaExceededState) {
    throw new FirestoreQuotaExceededError(
      `Batas kuota tulis harian Firebase telah tercapai. Operasi ${operationName} dibatalkan untuk menjaga keutuhan data.`
    );
  }
}

function handleWriteQuotaError(error: any, operationName: string) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('Free daily write units') ||
    error?.code === 'resource-exhausted'
  ) {
    quotaExceededState = true;
    throw new FirestoreQuotaExceededError(
      `Batas kuota tulis harian Firebase telah tercapai. Operasi ${operationName} dibatalkan.`
    );
  }
}

// Lazy initialization of Firebase Firestore directly targeting dbzafatourcgc client SDK
let dbInstance: any = null;

export function getFirestoreDb() {
  if (typeof window === 'undefined') return null;
  try {
    if (!dbInstance) {
      const existing = getApps();
      const app =
        existing.length > 0
          ? getApp()
          : initializeApp(firebaseConfig as any);
      
      const dbName = firebaseConfig.firestoreDatabaseId || FIREBASE_PROJECT_INFO.firestoreDatabaseName;
      try {
        dbInstance = getFirestore(app, dbName);
      } catch (e) {
        console.warn('Could not bind named Firestore database, falling back to default:', e);
        dbInstance = getFirestore(app);
      }
    }
    return dbInstance;
  } catch (err) {
    console.warn('Firebase init warning:', err);
    return null;
  }
}

export async function testConnection(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    if (
      error?.message?.includes('resource-exhausted') ||
      error?.code === 'resource-exhausted' ||
      error?.message?.includes('Quota limit exceeded')
    ) {
      quotaExceededState = true;
      return false;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

// Local storage cache keys for instant load & offline resilience
const STORAGE_KEYS = {
  HOTELS: 'zafa_hotels_v1',
  PACKAGES: 'zafa_packages_v1',
  DOCUMENTATION: 'zafa_doc_v1',
  SETTINGS: 'zafa_settings_v1',
};

// Initial Settings
export const DEFAULT_SETTINGS: AppSettings = {
  logoUrl: DEFAULT_ZAFA_LOGO,
  branchName: 'ZafaTour Perwakilan Citragrand City Palembang',
  address: 'Ruko CitraGrand City Blok A No. 12, Jl. Bypass Alang-Alang Lebar, Palembang, Sumatera Selatan',
  phone: '0811-715-608',
  whatsappNumber: WHATSAPP_NUMBER,
  firebaseProjectId: FIREBASE_PROJECT_INFO.projectId,
  firestoreDatabaseName: FIREBASE_PROJECT_INFO.firestoreDatabaseName,
};

// ==================== HOTELS (100% FIRESTORE CLIENT SDK) ====================

export async function fetchHotels(): Promise<Hotel[]> {
  const db = getFirestoreDb();
  if (db) {
    try {
      const colRef = collection(db, 'hotels');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items: Hotel[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as any) });
        });
        saveLocal(STORAGE_KEYS.HOTELS, items);
        return items;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'hotels');
    }
  }

  return loadLocal<Hotel[]>(STORAGE_KEYS.HOTELS, INITIAL_HOTELS);
}

export async function saveHotelRecord(hotel: Hotel): Promise<void> {
  checkQuotaExceeded('Simpan Hotel');

  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'hotels', hotel.id), hotel);
    } catch (error) {
      handleWriteQuotaError(error, 'Simpan Hotel');
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotel.id}`);
    }
  }

  // Simpan ke local cache hanya jika operasi Firestore berhasil atau tidak melebihi kuota
  const current = loadLocal<Hotel[]>(STORAGE_KEYS.HOTELS, INITIAL_HOTELS);
  const idx = current.findIndex((h) => h.id === hotel.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = hotel;
  } else {
    updated.unshift(hotel);
  }
  saveLocal(STORAGE_KEYS.HOTELS, updated);
}

export async function deleteHotelRecord(id: string): Promise<void> {
  checkQuotaExceeded('Hapus Hotel');

  const db = getFirestoreDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'hotels', id));
    } catch (error) {
      handleWriteQuotaError(error, 'Hapus Hotel');
      handleFirestoreError(error, OperationType.DELETE, `hotels/${id}`);
    }
  }

  // Hapus dari local cache hanya jika operasi Firestore berhasil atau tidak melebihi kuota
  const current = loadLocal<Hotel[]>(STORAGE_KEYS.HOTELS, INITIAL_HOTELS);
  const updated = current.filter((h) => h.id !== id);
  saveLocal(STORAGE_KEYS.HOTELS, updated);
}

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
 * Hanya paket dengan unsur kata PLM atau CGK yang diproses dan ditampilkan di data paket.
 */
export function isPlmOrCgk(text?: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return upper.includes('PLM') || upper.includes('CGK');
}

// ==================== PACKAGES (100% FIRESTORE CLIENT SDK) ====================

export async function fetchPackages(): Promise<UmrahPackage[]> {
  const db = getFirestoreDb();
  if (db) {
    try {
      const colRef = collection(db, 'packages');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items: UmrahPackage[] = [];
        snap.forEach((d) => {
          const pkgData = { id: d.id, ...(d.data() as any) };
          if (!isHajiKhususKemenag(pkgData.title) && isPlmOrCgk(pkgData.title)) {
            items.push(pkgData);
          }
        });
        saveLocal(STORAGE_KEYS.PACKAGES, items);
        return items;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'packages');
    }
  }

  const local = loadLocal<UmrahPackage[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
  const filtered = local.filter((p) => !isHajiKhususKemenag(p.title) && isPlmOrCgk(p.title));
  if (filtered.length !== local.length) {
    saveLocal(STORAGE_KEYS.PACKAGES, filtered);
  }
  return filtered;
}

export async function savePackageRecord(pkg: UmrahPackage): Promise<void> {
  checkQuotaExceeded('Simpan Paket');

  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'packages', pkg.id), pkg);
    } catch (error) {
      handleWriteQuotaError(error, 'Simpan Paket');
      handleFirestoreError(error, OperationType.WRITE, `packages/${pkg.id}`);
    }
  }

  // Simpan ke local cache hanya jika operasi Firestore berhasil atau tidak melebihi kuota
  const current = loadLocal<UmrahPackage[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
  const idx = current.findIndex((p) => p.id === pkg.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = pkg;
  } else {
    updated.unshift(pkg);
  }
  saveLocal(STORAGE_KEYS.PACKAGES, updated);
}

export async function deletePackageRecord(id: string): Promise<void> {
  checkQuotaExceeded('Hapus Paket');

  const db = getFirestoreDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'packages', id));
    } catch (error) {
      handleWriteQuotaError(error, 'Hapus Paket');
      handleFirestoreError(error, OperationType.DELETE, `packages/${id}`);
    }
  }

  // Hapus dari local cache hanya jika operasi Firestore berhasil atau tidak melebihi kuota
  const current = loadLocal<UmrahPackage[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
  const updated = current.filter((p) => p.id !== id);
  saveLocal(STORAGE_KEYS.PACKAGES, updated);
}

/**
 * Kategori Paket: "UMRAH", "HAJI", atau "HAJI KHUSUS".
 * Diambil dari 5 digit diawal nama Paket atau kata kunci judul.
 */
export function getCategoryFromTitle(title: string): PackageCategoryType {
  const clean = (title || '').trim().toUpperCase();
  if (clean.includes('HAJI KHUSUS') || clean.includes('HAJI PLUS') || clean.includes('HAJI FURODA')) {
    return 'HAJI KHUSUS';
  }
  const first5 = clean.slice(0, 5);
  if (first5.startsWith('HAJI')) {
    return 'HAJI';
  }
  if (first5.startsWith('UMRA') || first5.startsWith('UMRO')) {
    return 'UMRAH';
  }
  if (clean.includes('HAJI')) {
    return 'HAJI';
  }
  return 'UMRAH';
}

export function slugifyPackageTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
  return `pkg-${slug || Date.now()}`;
}

/**
 * Hapus semua data dari database paket (Firestore & LocalStorage)
 */
export async function clearAllPackages(): Promise<void> {
  checkQuotaExceeded('Hapus Semua Paket');

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'packages'));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'packages', d.id));
      }
    } catch (e) {
      handleWriteQuotaError(e, 'Hapus Semua Paket');
      handleFirestoreError(e, OperationType.DELETE, 'packages');
    }
  }

  saveLocal(STORAGE_KEYS.PACKAGES, []);
}

/**
 * Sinkronisasi data paket dari data seat Online:
 * 1. Paket yang ada di Seat akan menjadi nama paket di database paket.
 * 2. Paket hanya dibuat satu nama walau di data seat ada beberapa nama yang sama.
 * 3. Jika nama paket di data seat belum ada di database paket -> buat baru (foto, hotel, maskapai dikosongkan dulu, update via admin).
 * 4. Jika nama sudah terdaftar di database paket -> jangan dibuat baru, hanya refresh tanggal keberangkatan.
 * 5. Kategori Paket: "UMRAH", "HAJI", atau "HAJI KHUSUS".
 * 6. Tanggal-tanggal dari data seat untuk yang nama paketnya sama ditampilkan lengkap.
 * 7. Jika tanggal sudah tidak ada semua di seat online, tanggal keberangkatan dikosongkan sehingga memunculkan status Paket Habis.
 * 
 * Catatan: persistToFirestore hanya bernilai true saat Admin menekan tombol Sinkronkan Seat secara manual,
 * agar tidak menghabiskan kuota tulis harian Firestore pada setiap kali halaman dimuat oleh pengunjung biasa.
 */
export async function syncPackagesFromSeatData(
  seats: SeatInfo[],
  persistToFirestore: boolean = false
): Promise<UmrahPackage[]> {
  if (persistToFirestore) {
    checkQuotaExceeded('Sinkronisasi Data Seat ke Cloud Firestore');
  }

  if (!seats || seats.length === 0) {
    return fetchPackages();
  }

  // 1. Kelompokkan data seat berdasarkan nama paket (group) - HANYA unsur PLM dan CGK, Abaikan Haji Khusus Kemenag
  const groupedSeats = new Map<string, { displayTitle: string; schedules: SeatSchedule[] }>();

  for (const seat of seats) {
    const trimmedTitle = (seat.group || '').trim();
    if (
      !trimmedTitle ||
      isHajiKhususKemenag(trimmedTitle) ||
      !isPlmOrCgk(trimmedTitle) ||
      seat.sisaSeat <= 0
    ) {
      continue;
    }
    const key = trimmedTitle.toLowerCase();

    if (!groupedSeats.has(key)) {
      groupedSeats.set(key, { displayTitle: trimmedTitle, schedules: [] });
    }
    const entry = groupedSeats.get(key)!;
    // BUKAN DUPLIKASI: Jika ada nama group, tanggal, maupun jumlah seat yang sama di data seat online,
    // itu bukan duplikasi melainkan memang ada jadwal/kloter yang sama persis.
    entry.schedules.push({
      no: seat.no,
      departureDate: seat.departureDate,
      sisaSeat: seat.sisaSeat,
    });
  }

  // 1b. Rekonsiliasi tambahan dari Firestore koleksi 'live_seats':
  // Jika di live_seats terdapat jadwal/kloter yang belum tercakup di seats, tambahkan ke groupedSeats
  const db = getFirestoreDb();
  if (db) {
    try {
      const liveSeatsSnap = await getDocs(collection(db, 'live_seats'));
      liveSeatsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.group && !isHajiKhususKemenag(d.group) && isPlmOrCgk(d.group)) {
          const key = d.group.trim().toLowerCase();
          const batchList = Array.isArray(d.batches) ? d.batches : Array.isArray(d.schedules) ? d.schedules : [];
          for (const b of batchList) {
            if (b && typeof b.sisaSeat === 'number' && b.sisaSeat > 0 && b.departureDate) {
              if (!groupedSeats.has(key)) {
                groupedSeats.set(key, { displayTitle: d.group.trim(), schedules: [] });
              }
              const entry = groupedSeats.get(key)!;
              const alreadyExists = entry.schedules.some(
                (s) => s.departureDate === b.departureDate && s.sisaSeat === b.sisaSeat && (s.no || 0) === (b.no || 0)
              );
              if (!alreadyExists) {
                entry.schedules.push({
                  no: b.no || 0,
                  departureDate: b.departureDate,
                  sisaSeat: b.sisaSeat,
                });
              }
            }
          }
        }
      });
    } catch {
      // Abaikan jika pembacaan live_seats tidak berhasil
    }
  }

  // Sort jadwal masing-masing group paket secara kronologis berdasarkan tanggal keberangkatan, lalu berdasarkan No
  for (const entry of groupedSeats.values()) {
    entry.schedules.sort((a, b) => {
      const da = normalizeDateToISO(a.departureDate) || a.departureDate;
      const db = normalizeDateToISO(b.departureDate) || b.departureDate;
      const comp = da.localeCompare(db);
      if (comp !== 0) return comp;
      return (a.no || 0) - (b.no || 0);
    });
  }

  // 2. Ambil paket yang sudah ada dari database paket
  const existingPackages = await fetchPackages();
  const existingMap = new Map<string, UmrahPackage>();

  for (const pkg of existingPackages) {
    if (isHajiKhususKemenag(pkg.title) || !isPlmOrCgk(pkg.title)) {
      continue;
    }
    const key = (pkg.title || '').trim().toLowerCase();
    if (key && !existingMap.has(key)) {
      existingMap.set(key, pkg);
    }
  }

  const resultPackages: UmrahPackage[] = [];

  // 3. Proses setiap nama paket unik dari data seat
  for (const [key, entry] of groupedSeats.entries()) {
    // Susun tanggal unik terurut kronologis
    const uniqueDates = Array.from(new Set(entry.schedules.map((s) => s.departureDate))).filter(Boolean);
    uniqueDates.sort((a, b) => {
      const da = normalizeDateToISO(a) || a;
      const db = normalizeDateToISO(b) || b;
      return da.localeCompare(db);
    });
    const primaryDate = uniqueDates[0] || '';
    const existing = existingMap.get(key);

    if (existing) {
      // JIKA NAMA SUDAH TERDAFTAR: JANGAN CREATE BARU!
      // Hanya refresh tanggal keberangkatan & jadwal seat, pertahankan foto, hotel, maskapai, harga yang sudah diupdate admin
      const currentCat = existing.category;
      const normalizedCategory =
        currentCat === 'Umroh'
          ? 'UMRAH'
          : currentCat === 'Haji Khusus'
          ? 'HAJI KHUSUS'
          : (currentCat || getCategoryFromTitle(existing.title));

      const existingDates = (
        existing.departureDates && existing.departureDates.length > 0
          ? existing.departureDates
          : existing.departureDate ? [existing.departureDate] : []
      ).map((d) => d.trim()).filter(Boolean);

      const existingSchedules = existing.seatSchedules || [];

      // DIRTY CHECKING (Cek apakah ada perubahan nyata):
      // 1. Cek apakah daftar tanggal berubah
      const datesChanged =
        existingDates.length !== uniqueDates.length ||
        existingDates.some((d, idx) => d !== uniqueDates[idx]);

      // 2. Cek apakah jadwal / sisa kursi tiap kloter berubah
      const schedsChanged =
        existingSchedules.length !== entry.schedules.length ||
        existingSchedules.some((s, idx) => {
          const target = entry.schedules[idx];
          return (
            s.departureDate !== target.departureDate ||
            s.sisaSeat !== target.sisaSeat ||
            (s.no || 0) !== (target.no || 0)
          );
        });

      // 3. Cek apakah primary date atau category berubah
      const primaryDateChanged = (existing.departureDate || '') !== primaryDate;
      const categoryChanged = existing.category !== normalizedCategory;

      const hasChanged = datesChanged || schedsChanged || primaryDateChanged || categoryChanged;

      const updatedPkg: UmrahPackage = {
        ...existing,
        category: normalizedCategory,
        departureDate: primaryDate || '',
        departureDates: uniqueDates,
        seatSchedules: entry.schedules,
        updatedAt: hasChanged ? new Date().toISOString() : existing.updatedAt,
      };
      resultPackages.push(updatedPkg);

      // PENTING: Hanya tulis ke Firestore JIKA DAN HANYA JIKA ada perubahan nyata (Dirty Checking)
      // Jika data sama persis, TIDAK ADA penulisan ke Firestore (0 write) guna menghemat kuota!
      if (db && persistToFirestore && !quotaExceededState && hasChanged) {
        try {
          await setDoc(doc(db, 'packages', updatedPkg.id), updatedPkg);
          console.info(`[Auto-Sync Firestore] Memperbarui departureDates paket '${updatedPkg.title}' (terdeteksi perubahan jadwal).`);
        } catch (err) {
          handleWriteQuotaError(err, 'Sinkronisasi Paket');
          handleFirestoreError(err, OperationType.WRITE, `packages/${updatedPkg.id}`);
        }
      }
    } else {
      // JIKA BELUM ADA DI DATABASE: BUAT DATA PAKET BARU
      // Data foto, hotel, maskapai dikosongkan dulu saat pertama kali creat otomatis
      const durationMatch = entry.displayTitle.match(/(\d+)\s*H\b/i);
      const parsedDuration = durationMatch ? parseInt(durationMatch[1], 10) : 0;

      const newPkg: UmrahPackage = {
        id: slugifyPackageTitle(entry.displayTitle),
        title: entry.displayTitle,
        category: getCategoryFromTitle(entry.displayTitle),
        packagePhoto: '',
        departureDate: primaryDate,
        departureDates: uniqueDates,
        seatSchedules: entry.schedules,
        makkahHotelId: '',
        makkahHotelName: '',
        distanceToKaaba: '',
        makkahHotel2Id: '',
        makkahHotel2Name: '',
        distanceToKaaba2: '',
        madinahHotelId: '',
        madinahHotelName: '',
        distanceToNabawi: '',
        madinahHotel2Id: '',
        madinahHotel2Name: '',
        distanceToNabawi2: '',
        airline: '',
        departureAirport: '',
        arrivalAirport: '',
        price: 0,
        durationDays: parsedDuration,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      resultPackages.push(newPkg);

      if (db && persistToFirestore && !quotaExceededState) {
        try {
          await setDoc(doc(db, 'packages', newPkg.id), newPkg);
        } catch (err) {
          handleWriteQuotaError(err, 'Sinkronisasi Paket');
          handleFirestoreError(err, OperationType.WRITE, `packages/${newPkg.id}`);
        }
      }
    }
  }

  // 4. Sertakan juga paket di database yang saat ini tidak tercantum di groupedSeats
  // PENTING: JANGAN mengosongkan/menghapus jadwal yang sudah tersimpan di dokumen paket jika dokumen paket memang memiliki jadwal & sisa kursi!
  for (const [key, pkg] of existingMap.entries()) {
    if (isHajiKhususKemenag(pkg.title) || !isPlmOrCgk(pkg.title)) continue;
    if (!groupedSeats.has(key)) {
      const currentCat = pkg.category;
      const normalizedCategory =
        currentCat === 'Umroh'
          ? 'UMRAH'
          : currentCat === 'Haji Khusus'
          ? 'HAJI KHUSUS'
          : (currentCat || getCategoryFromTitle(pkg.title));

      // Jika paket di database sudah memiliki jadwal atau tanggal, pertahankan utuh
      const existingSchedules = pkg.seatSchedules && pkg.seatSchedules.length > 0 ? pkg.seatSchedules : [];
      const existingDates =
        pkg.departureDates && pkg.departureDates.length > 0
          ? pkg.departureDates
          : pkg.departureDate
          ? [pkg.departureDate]
          : [];

      const hasChanged = pkg.category !== normalizedCategory;

      const updatedPkg: UmrahPackage = {
        ...pkg,
        category: normalizedCategory,
        departureDate: pkg.departureDate || (existingDates[0] || ''),
        departureDates: existingDates,
        seatSchedules: existingSchedules,
        updatedAt: hasChanged ? new Date().toISOString() : pkg.updatedAt,
      };
      resultPackages.push(updatedPkg);

      if (db && persistToFirestore && !quotaExceededState && hasChanged) {
        try {
          await setDoc(doc(db, 'packages', updatedPkg.id), updatedPkg);
        } catch (err) {
          handleWriteQuotaError(err, 'Sinkronisasi Paket');
          handleFirestoreError(err, OperationType.WRITE, `packages/${updatedPkg.id}`);
        }
      }
    }
  }

  // 5. Simpan ke local storage (pastikan HANYA PLM dan CGK, dan tidak ada Haji Khusus Kemenag)
  const finalPackages = resultPackages.filter(
    (p) => !isHajiKhususKemenag(p.title) && isPlmOrCgk(p.title)
  );
  saveLocal(STORAGE_KEYS.PACKAGES, finalPackages);

  return finalPackages;
}

// ==================== DOCUMENTATION (100% FIRESTORE CLIENT SDK) ====================

export async function fetchDocumentations(): Promise<DocumentationItem[]> {
  const db = getFirestoreDb();
  if (db) {
    try {
      const colRef = collection(db, 'documentations');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items: DocumentationItem[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as any) });
        });
        saveLocal(STORAGE_KEYS.DOCUMENTATION, items);
        return items;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'documentations');
    }
  }

  return loadLocal<DocumentationItem[]>(
    STORAGE_KEYS.DOCUMENTATION,
    INITIAL_DOCUMENTATION
  );
}

export async function saveDocumentationRecord(
  item: DocumentationItem
): Promise<void> {
  checkQuotaExceeded('Simpan Dokumentasi');

  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'documentations', item.id), item);
    } catch (error) {
      handleWriteQuotaError(error, 'Simpan Dokumentasi');
      handleFirestoreError(error, OperationType.WRITE, `documentations/${item.id}`);
    }
  }

  // Simpan ke local cache hanya jika operasi Firestore berhasil atau tidak melebihi kuota
  const current = loadLocal<DocumentationItem[]>(
    STORAGE_KEYS.DOCUMENTATION,
    INITIAL_DOCUMENTATION
  );
  const idx = current.findIndex((d) => d.id === item.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = item;
  } else {
    updated.unshift(item);
  }
  saveLocal(STORAGE_KEYS.DOCUMENTATION, updated);
}

export async function deleteDocumentationRecord(id: string): Promise<void> {
  checkQuotaExceeded('Hapus Dokumentasi');

  const db = getFirestoreDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'documentations', id));
    } catch (error) {
      handleWriteQuotaError(error, 'Hapus Dokumentasi');
      handleFirestoreError(error, OperationType.DELETE, `documentations/${id}`);
    }
  }

  // Hapus dari local cache hanya jika operasi Firestore berhasil atau tidak melebihi kuota
  const current = loadLocal<DocumentationItem[]>(
    STORAGE_KEYS.DOCUMENTATION,
    INITIAL_DOCUMENTATION
  );
  const updated = current.filter((d) => d.id !== id);
  saveLocal(STORAGE_KEYS.DOCUMENTATION, updated);
}

// ==================== SETTINGS (100% FIRESTORE CLIENT SDK) ====================

export async function fetchSettings(): Promise<AppSettings> {
  const localData = loadLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (!localData.logoUrl || localData.logoUrl.startsWith('data:image/svg')) {
    localData.logoUrl = DEFAULT_ZAFA_LOGO;
    saveLocal(STORAGE_KEYS.SETTINGS, localData);
  }

  const db = getFirestoreDb();
  if (!db) return localData;

  try {
    const colRef = collection(db, 'settings');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const docData = snap.docs[0].data() as AppSettings;
      if (!docData.logoUrl || docData.logoUrl.startsWith('data:image/svg')) {
        docData.logoUrl = DEFAULT_ZAFA_LOGO;
      }
      saveLocal(STORAGE_KEYS.SETTINGS, docData);
      return docData;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/branding');
  }

  return localData;
}

export async function saveSettingsRecord(settings: AppSettings): Promise<void> {
  checkQuotaExceeded('Simpan Pengaturan');

  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'branding'), settings);
    } catch (error) {
      handleWriteQuotaError(error, 'Simpan Pengaturan');
      handleFirestoreError(error, OperationType.WRITE, 'settings/branding');
    }
  }

  saveLocal(STORAGE_KEYS.SETTINGS, settings);
}

// Convenient function aliases
export const getHotels = fetchHotels;
export const saveHotel = saveHotelRecord;
export const deleteHotel = deleteHotelRecord;

export const getPackages = fetchPackages;
export const savePackage = savePackageRecord;
export const deletePackage = deletePackageRecord;
export const syncPackagesWithSeats = syncPackagesFromSeatData;
export const clearPackages = clearAllPackages;

export const getDocumentations = fetchDocumentations;
export const saveDocumentation = saveDocumentationRecord;
export const deleteDocumentation = deleteDocumentationRecord;

export const getSettings = fetchSettings;
export const saveSettings = saveSettingsRecord;
export const DEFAULT_APP_SETTINGS = DEFAULT_SETTINGS;
