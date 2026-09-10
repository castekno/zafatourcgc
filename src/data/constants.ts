import { Hotel, UmrahPackage, DocumentationItem } from '../types';

export const AIRLINES = [
  'Garuda Indonesia (GA)',
  'Saudia Airlines (SV)',
  'Lion Air (JT)',
  'Batik Air (ID)',
  'Citilink (QG)',
  'Oman Air (WY)',
  'Qatar Airways (QR)',
  'Emirates (EK)',
  'Scoot (TR)',
];

export const DEPARTURE_AIRPORTS = [
  'Bandara Sultan Mahmud Badaruddin II Palembang (PLM)',
  'Bandara Internasional Soekarno-Hatta Jakarta (CGK)',
  'Bandara Internasional Kertajati Majalengka (KJT)',
  'Bandara Internasional Juanda Surabaya (SUB)',
  'Bandara Internasional Kualanamu Medan (KNO)',
  'Bandara Internasional Minangkabau Padang (PDG)',
  'Bandara Internasional Sultan Hasanuddin Makassar (UPG)',
  'Bandara Internasional Hang Nadim Batam (BTH)',
  'Bandara Internasional Yogyakarta (YIA)',
];

export const ARRIVAL_AIRPORTS = [
  'Jedah King Abdulazis',
  'Madinah Mohammad Bin Abdulaziz',
] as const;

export const ADMIN_PASSWORD = 'shahnam85';
export const WHATSAPP_NUMBER = '0811-715-608';
export const WHATSAPP_LINK = 'https://wa.me/62811715608?text=' + encodeURIComponent('Halo ZafaTour Perwakilan CGC Palembang, saya ingin konsultasi paket Umroh/Haji.');

export const KAABA_COORDS = { lat: 21.4225, lng: 39.8262 };
export const NABAWI_COORDS = { lat: 24.4672, lng: 39.6108 };

// Official Zafa Tour Logo (Uploaded from user photo, Royal Blue & Yellow with Umrah & Hajj Services)
export const DEFAULT_ZAFA_LOGO = '/zafa_logo.jpg';

// All data and photos loaded directly from Firebase Firestore Database (dbzafatourcgc)
export const INITIAL_HOTELS: Hotel[] = [];
export const INITIAL_PACKAGES: UmrahPackage[] = [];
export const INITIAL_DOCUMENTATION: DocumentationItem[] = [];
