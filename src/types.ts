export type CityType = 'Makkah' | 'Madinah';

export interface Hotel {
  id: string;
  name: string;
  city: CityType;
  stars: number; // 3, 4, or 5
  address: string;
  photos: string[]; // up to 6 photos
  mapUrl: string;
  distanceToCenterMeters?: number; // e.g. 150 (meters to Kaaba/Nabawi)
  createdAt?: string;
  updatedAt?: string;
}

export type ArrivalAirportType =
  | 'Jedah King Abdulazis'
  | 'Madinah Mohammad Bin Abdulaziz';

export interface SeatSchedule {
  no?: number;
  departureDate: string;
  sisaSeat: number;
}

export type PackageCategoryType = 'UMRAH' | 'HAJI' | 'HAJI KHUSUS';

export interface UmrahPackage {
  id: string;
  title: string;
  packagePhoto: string;
  departureDate: string;
  departureDates?: string[]; // All departure dates matching this package from online seat data
  seatSchedules?: SeatSchedule[]; // Sisa seat breakdown per date
  makkahHotelId: string;
  makkahHotelName?: string;
  distanceToKaaba?: string; // calculated from Makkah hotel to Kaaba
  makkahHotel2Id?: string;
  makkahHotel2Name?: string;
  distanceToKaaba2?: string;
  madinahHotelId: string;
  madinahHotelName?: string;
  distanceToNabawi?: string; // calculated from Madinah hotel to Masjid Nabawi
  madinahHotel2Id?: string;
  madinahHotel2Name?: string;
  distanceToNabawi2?: string;
  airline: string;
  departureAirport: string;
  arrivalAirport: ArrivalAirportType | string;
  price: number;
  durationDays: number;
  category: PackageCategoryType | string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentationItem {
  id: string;
  title: string;
  eventDate: string;
  photos: string[]; // Dynamic count - can add or remove freely
  description: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeatInfo {
  no: number;
  group: string;
  departureDate: string;
  sisaSeat: number;
}

export interface AppSettings {
  logoUrl: string;
  branchName: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  firebaseProjectId: string;
  firestoreDatabaseName: string;
}

export type PrayerName =
  | 'Imsak'
  | 'Subuh'
  | 'Terbit'
  | 'Dzuhur'
  | 'Ashar'
  | 'Maghrib'
  | 'Isya';

export interface PrayerTimeSlot {
  name: PrayerName;
  timeString: string; // HH:mm
  dateObj: Date;
  isNext: boolean;
  isCurrent: boolean;
  passed: boolean;
}

export interface UserLocationInfo {
  latitude: number;
  longitude: number;
  cityName: string;
  districtName?: string;
  source: 'gps' | 'fallback' | 'custom';
  updatedAt: string;
}

export interface PrayerCountdownInfo {
  nextPrayerName: PrayerName;
  nextPrayerTimeStr: string;
  timeRemainingStr: string; // e.g. "01:45:20"
  totalSecondsRemaining: number;
}
