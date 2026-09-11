// Lightweight in-memory fallback cache to store full dataset without hitting browser quota limits
const MEMORY_CACHE: Record<string, any> = {};

/**
 * Strips huge base64 strings if needed when caching to localStorage so storage quota is never breached.
 */
function sanitizeForLocalStorage<T>(data: T): T {
  if (!data) return data;
  try {
    const serialized = JSON.stringify(data);
    // If under 400KB, it's totally safe to store as-is
    if (serialized.length < 400000) {
      return data;
    }

    // If large array, create lean version with trimmed/compressed photos
    if (Array.isArray(data)) {
      return data.map((item: any) => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        // If hotel has many large photos
        if (Array.isArray(copy.photos)) {
          copy.photos = copy.photos.slice(0, 3).map((p: string) => {
            if (typeof p === 'string' && p.length > 30000) {
              return p.substring(0, 200); // keep indicator or lean reference
            }
            return p;
          });
        }
        // If package has huge photo
        if (typeof copy.packagePhoto === 'string' && copy.packagePhoto.length > 30000) {
          copy.packagePhoto = copy.packagePhoto.substring(0, 200);
        }
        // If doc has huge photo/video
        if (typeof copy.mediaUrl === 'string' && copy.mediaUrl.length > 30000) {
          copy.mediaUrl = copy.mediaUrl.substring(0, 200);
        }
        return copy;
      }) as any;
    }

    return data;
  } catch {
    return data;
  }
}

// Helper: Local fallback loader
export function loadLocal<T>(key: string, fallback: T): T {
  if (MEMORY_CACHE[key]) {
    return MEMORY_CACHE[key];
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      MEMORY_CACHE[key] = parsed;
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read from local storage:', e);
  }
  return fallback;
}

export function saveLocal<T>(key: string, data: T): void {
  // Always update in-memory cache instantly
  MEMORY_CACHE[key] = data;

  try {
    // 1. Try saving directly
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: any) {
    // Check if error is quota exceeded
    const isQuotaError =
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014 ||
      (e.message && e.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`LocalStorage quota reached for key "${key}". Cleaning up and applying lightweight cache.`);
      try {
        // Clear obsolete or non-essential keys first
        const keysToPrune = ['zafa_official_seats_cache_v2', 'zafa_doc_v1'];
        for (const k of keysToPrune) {
          if (k !== key) {
            localStorage.removeItem(k);
          }
        }

        // Try saving sanitized lightweight version
        const sanitized = sanitizeForLocalStorage(data);
        localStorage.setItem(key, JSON.stringify(sanitized));
      } catch (innerErr) {
        // Fallback: gracefully rely on in-memory cache and Firestore without unhandled exception
        console.warn('Could not save to localStorage even after sanitation; in-memory and Firestore remain active.');
      }
    } else {
      console.warn('Failed to save to local storage:', e?.message || e);
    }
  }
}
