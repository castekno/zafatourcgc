import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  Hotel,
  UmrahPackage,
  DocumentationItem,
  AppSettings,
} from '../types';
import {
  INITIAL_HOTELS,
  INITIAL_PACKAGES,
  INITIAL_DOCUMENTATION,
  DEFAULT_ZAFA_LOGO,
  WHATSAPP_NUMBER,
} from '../data/constants';
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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

// Lazy initialization of Firebase Firestore targeting dbzafatourcgc
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

// Local storage keys for hybrid sync
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

// Helper: Local fallback loader
function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read from local storage:', e);
  }
  return fallback;
}

function saveLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to local storage:', e);
  }
}

// ==================== HOTELS ====================

export async function fetchHotels(): Promise<Hotel[]> {
  // 1. Prioritize reading directly from Firestore database
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

  // 2. Fallback to server API if offline or initializing
  try {
    const res = await fetch('/api/hotels');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        saveLocal(STORAGE_KEYS.HOTELS, data.data);
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch hotels from server API:', err);
  }

  return loadLocal<Hotel[]>(STORAGE_KEYS.HOTELS, INITIAL_HOTELS);
}

export async function saveHotelRecord(hotel: Hotel): Promise<void> {
  // 1. Instant local persistence
  const current = loadLocal<Hotel[]>(STORAGE_KEYS.HOTELS, INITIAL_HOTELS);
  const idx = current.findIndex((h) => h.id === hotel.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = hotel;
  } else {
    updated.unshift(hotel);
  }
  saveLocal(STORAGE_KEYS.HOTELS, updated);

  // 2. Direct Firestore Database persistence
  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'hotels', hotel.id), hotel);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotel.id}`);
    }
  }

  // 3. Server-side database API persistence sync
  try {
    await fetch('/api/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotel),
    });
  } catch (err) {
    console.error('Failed to save hotel to server API:', err);
  }
}

export async function deleteHotelRecord(id: string): Promise<void> {
  // 1. Instant local persistence
  const current = loadLocal<Hotel[]>(STORAGE_KEYS.HOTELS, INITIAL_HOTELS);
  const updated = current.filter((h) => h.id !== id);
  saveLocal(STORAGE_KEYS.HOTELS, updated);

  // 2. Direct Firestore Database deletion
  const db = getFirestoreDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'hotels', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `hotels/${id}`);
    }
  }

  // 3. Server-side database API deletion sync
  try {
    await fetch(`/api/hotels/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.error('Failed to delete hotel from server API:', err);
  }
}

// ==================== PACKAGES ====================

export async function fetchPackages(): Promise<UmrahPackage[]> {
  // 1. Prioritize reading directly from Firestore database
  const db = getFirestoreDb();
  if (db) {
    try {
      const colRef = collection(db, 'packages');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const items: UmrahPackage[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as any) });
        });
        saveLocal(STORAGE_KEYS.PACKAGES, items);
        return items;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'packages');
    }
  }

  // 2. Fallback to server API if offline or initializing
  try {
    const res = await fetch('/api/packages');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        saveLocal(STORAGE_KEYS.PACKAGES, data.data);
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch packages from server API:', err);
  }

  return loadLocal<UmrahPackage[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
}

export async function savePackageRecord(pkg: UmrahPackage): Promise<void> {
  // 1. Instant local persistence
  const current = loadLocal<UmrahPackage[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
  const idx = current.findIndex((p) => p.id === pkg.id);
  const updated = [...current];
  if (idx >= 0) {
    updated[idx] = pkg;
  } else {
    updated.unshift(pkg);
  }
  saveLocal(STORAGE_KEYS.PACKAGES, updated);

  // 2. Direct Firestore Database persistence
  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'packages', pkg.id), pkg);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `packages/${pkg.id}`);
    }
  }

  // 3. Server-side database API persistence sync
  try {
    await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg),
    });
  } catch (err) {
    console.error('Failed to save package to server API:', err);
  }
}

export async function deletePackageRecord(id: string): Promise<void> {
  // 1. Instant local persistence
  const current = loadLocal<UmrahPackage[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
  const updated = current.filter((p) => p.id !== id);
  saveLocal(STORAGE_KEYS.PACKAGES, updated);

  // 2. Direct Firestore Database deletion
  const db = getFirestoreDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'packages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `packages/${id}`);
    }
  }

  // 3. Server-side database API deletion sync
  try {
    await fetch(`/api/packages/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.error('Failed to delete package from server API:', err);
  }
}

// ==================== DOCUMENTATION ====================

export async function fetchDocumentations(): Promise<DocumentationItem[]> {
  // 1. Prioritize reading directly from Firestore database
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

  // 2. Fallback to server API if offline or initializing
  try {
    const res = await fetch('/api/documentations');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        saveLocal(STORAGE_KEYS.DOCUMENTATION, data.data);
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch documentations from server API:', err);
  }

  return loadLocal<DocumentationItem[]>(
    STORAGE_KEYS.DOCUMENTATION,
    INITIAL_DOCUMENTATION
  );
}

export async function saveDocumentationRecord(
  item: DocumentationItem
): Promise<void> {
  // 1. Instant local persistence
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

  // 2. Direct Firestore Database persistence
  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'documentations', item.id), item);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `documentations/${item.id}`);
    }
  }

  // 3. Server-side database API persistence sync
  try {
    await fetch('/api/documentations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch (err) {
    console.error('Failed to save documentation to server API:', err);
  }
}

export async function deleteDocumentationRecord(id: string): Promise<void> {
  // 1. Instant local persistence
  const current = loadLocal<DocumentationItem[]>(
    STORAGE_KEYS.DOCUMENTATION,
    INITIAL_DOCUMENTATION
  );
  const updated = current.filter((d) => d.id !== id);
  saveLocal(STORAGE_KEYS.DOCUMENTATION, updated);

  // 2. Direct Firestore Database deletion
  const db = getFirestoreDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'documentations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `documentations/${id}`);
    }
  }

  // 3. Server-side database API deletion sync
  try {
    await fetch(`/api/documentations/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.error('Failed to delete documentation from server API:', err);
  }
}

// ==================== SETTINGS (LOGO & BRANDING) ====================

export async function fetchSettings(): Promise<AppSettings> {
  const localData = loadLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (!localData.logoUrl || localData.logoUrl.startsWith('data:image/svg')) {
    localData.logoUrl = DEFAULT_ZAFA_LOGO;
    saveLocal(STORAGE_KEYS.SETTINGS, localData);
  }

  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        saveLocal(STORAGE_KEYS.SETTINGS, data.data);
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch settings from server API:', err);
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
  saveLocal(STORAGE_KEYS.SETTINGS, settings);

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch (err) {
    console.error('Failed to save settings to server API:', err);
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'branding'), settings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/branding');
    }
  }
}

// Convenient function aliases
export const getHotels = fetchHotels;
export const saveHotel = saveHotelRecord;
export const deleteHotel = deleteHotelRecord;

export const getPackages = fetchPackages;
export const savePackage = savePackageRecord;
export const deletePackage = deletePackageRecord;

export const getDocumentations = fetchDocumentations;
export const saveDocumentation = saveDocumentationRecord;
export const deleteDocumentation = deleteDocumentationRecord;

export const getSettings = fetchSettings;
export const saveSettings = saveSettingsRecord;
export const DEFAULT_APP_SETTINGS = DEFAULT_SETTINGS;

