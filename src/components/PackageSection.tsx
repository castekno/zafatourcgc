import { useState, useEffect, useId, FormEvent, ChangeEvent } from 'react';
import {
  Calendar,
  Plane,
  Building2,
  MapPin,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Upload,
  X,
  Compass,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Maximize2,
} from 'lucide-react';
import { UmrahPackage, Hotel, ArrivalAirportType, SeatInfo, SeatSchedule, PackageCategoryType } from '../types';
import { fetchLiveSeatData } from '../services/seatService';
import {
  AIRLINES,
  DEPARTURE_AIRPORTS,
  ARRIVAL_AIRPORTS,
} from '../data/constants';
import { formatCurrencyIDR, getDistanceToKaaba, getDistanceToNabawi } from '../utils/distance';
import { compressImageFile } from '../utils/imageCompress';
import {
  checkPackageAndSeatAvailability,
  isTitleMatchingSeatGroup,
  isDateMatching,
  normalizeDateToISO,
} from '../utils/seatSync';
import { getCategoryFromTitle, isHajiKhususKemenag, isPlmOrCgk } from '../firebase/service';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface PackageSectionProps {
  packages: UmrahPackage[];
  hotels: Hotel[];
  seats?: SeatInfo[];
  isAdmin: boolean;
  onSavePackage: (pkg: UmrahPackage) => Promise<void>;
  onDeletePackage: (id: string) => Promise<void>;
  onSyncWithSeats?: () => Promise<void>;
  onClearPackages?: () => Promise<void>;
}

export default function PackageSection({
  packages,
  hotels,
  seats = [],
  isAdmin,
  onSavePackage,
  onDeletePackage,
  onSyncWithSeats,
  onClearPackages,
}: PackageSectionProps) {
  const pkgCategoryFilterId = useId();
  const pkgTitleInputId = useId();
  const pkgCategoryInputId = useId();
  const pkgDepartureDateInputId = useId();
  const pkgPriceInputId = useId();
  const pkgDurationInputId = useId();
  const pkgAirlineInputId = useId();
  const pkgDepartureAirportInputId = useId();
  const pkgArrivalAirportInputId = useId();
  const pkgMakkahHotelInputId = useId();
  const pkgMakkahHotel2InputId = useId();
  const pkgMadinahHotelInputId = useId();
  const pkgMadinahHotel2InputId = useId();
  const pkgPhotoInputId = useId();
  const pkgNotesInputId = useId();

  const [categoryFilter, setCategoryFilter] = useState<'All' | PackageCategoryType>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<UmrahPackage | null>(null);
  const [deletePkgTarget, setDeletePkgTarget] = useState<{ id: string; title: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Local active seats state (synced with props or fetched as fallback) - Khusus PLM & CGK
  const [activeSeats, setActiveSeats] = useState<SeatInfo[]>(
    seats.filter((s) => !isHajiKhususKemenag(s.group) && isPlmOrCgk(s.group))
  );

  useEffect(() => {
    if (seats && seats.length > 0) {
      setActiveSeats(seats.filter((s) => !isHajiKhususKemenag(s.group) && isPlmOrCgk(s.group)));
    } else {
      fetchLiveSeatData()
        .then((data) => {
          setActiveSeats(data.filter((s: SeatInfo) => s.sisaSeat > 0 && !isHajiKhususKemenag(s.group) && isPlmOrCgk(s.group)));
        })
        .catch((err) => console.warn('Could not load seats for sync:', err));
    }
  }, [seats]);

  // Form states
  const [title, setTitle] = useState('');
  const [packagePhoto, setPackagePhoto] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [category, setCategory] = useState<PackageCategoryType>('UMRAH');
  const [price, setPrice] = useState<number>(32000000);
  const [durationDays, setDurationDays] = useState<number>(11);
  const [airline, setAirline] = useState<string>(AIRLINES[0]);
  const [departureAirport, setDepartureAirport] = useState<string>(DEPARTURE_AIRPORTS[0]);
  const [arrivalAirport, setArrivalAirport] = useState<ArrivalAirportType>(ARRIVAL_AIRPORTS[0]);
  // 2 Hotels for Makkah and 2 Hotels for Madinah
  const [makkahHotelId, setMakkahHotelId] = useState<string>('');
  const [makkahHotel2Id, setMakkahHotel2Id] = useState<string>('');
  const [madinahHotelId, setMadinahHotelId] = useState<string>('');
  const [madinahHotel2Id, setMadinahHotel2Id] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Hotel picklists filtered by city
  const makkahHotels = hotels.filter((h) => h.city === 'Makkah');
  const madinahHotels = hotels.filter((h) => h.city === 'Madinah');

  // Selected hotel objects for calculating distances
  const selectedMakkahHotel = hotels.find((h) => h.id === makkahHotelId);
  const selectedMakkahHotel2 = hotels.find((h) => h.id === makkahHotel2Id);
  const selectedMadinahHotel = hotels.find((h) => h.id === madinahHotelId);
  const selectedMadinahHotel2 = hotels.find((h) => h.id === madinahHotel2Id);

  // Dynamic calculated distances
  const viewDistanceKaaba = selectedMakkahHotel
    ? getDistanceToKaaba(selectedMakkahHotel.mapUrl, selectedMakkahHotel.distanceToCenterMeters)
    : '-';
  const viewDistanceKaaba2 = selectedMakkahHotel2
    ? getDistanceToKaaba(selectedMakkahHotel2.mapUrl, selectedMakkahHotel2.distanceToCenterMeters)
    : '';
  const viewDistanceNabawi = selectedMadinahHotel
    ? getDistanceToNabawi(selectedMadinahHotel.mapUrl, selectedMadinahHotel.distanceToCenterMeters)
    : '-';
  const viewDistanceNabawi2 = selectedMadinahHotel2
    ? getDistanceToNabawi(selectedMadinahHotel2.mapUrl, selectedMadinahHotel2.distanceToCenterMeters)
    : '';

  // Live real-time check between Nama Paket + Tanggal Berangkat with Nama Group + Tanggal Berangkat in active seats
  const seatCheck = checkPackageAndSeatAvailability(title, departureDate, activeSeats);

  const [isSyncing, setIsSyncing] = useState(false);

  // Helper untuk mendapatkan semua tanggal dari data seat online yang memiliki nama paket sama persis (Group)
  const getMatchingSeats = (pkg: UmrahPackage): SeatSchedule[] => {
    const normTitle = (pkg.title || '').trim().toLowerCase();

    // 1. Ambil dari activeSeats yang nama group-nya SAMA PERSIS dengan judul paket
    const exactActive = activeSeats.filter((s) => {
      const groupNorm = (s.group || '').trim().toLowerCase();
      return groupNorm === normTitle && !isHajiKhususKemenag(s.group);
    });

    if (exactActive.length > 0) {
      const seen = new Set<string>();
      const result: SeatSchedule[] = [];
      for (const item of exactActive) {
        if (!seen.has(item.departureDate)) {
          seen.add(item.departureDate);
          result.push({ departureDate: item.departureDate, sisaSeat: item.sisaSeat });
        }
      }
      result.sort((a, b) => {
        const da = normalizeDateToISO(a.departureDate) || a.departureDate;
        const db = normalizeDateToISO(b.departureDate) || b.departureDate;
        return da.localeCompare(db);
      });
      return result;
    }

    // 2. Jika tidak ada exact match di activeSeats, gunakan seatSchedules yang tersimpan langsung di dokumen paket
    if (pkg.seatSchedules && pkg.seatSchedules.length > 0) {
      return pkg.seatSchedules;
    }

    // 3. Fallback departureDates jika ada
    if (pkg.departureDates && pkg.departureDates.length > 0) {
      return pkg.departureDates.map((d) => ({
        departureDate: d,
        sisaSeat: 0,
      }));
    }

    return [];
  };

  // Sorting: Default 'group' sesuai Group di https://seat.zafatour.com/ agar mudah mengeceknya
  const [packageSortBy, setPackageSortBy] = useState<'group' | 'date'>('group');

  // Pastikan Haji Khusus Kemenag tidak pernah dimasukkan ke paket dan HANYA proses/tampilkan paket dengan unsur kata PLM dan CGK
  const sortedPackages = [...packages]
    .filter((p) => !isHajiKhususKemenag(p.title) && isPlmOrCgk(p.title))
    .sort((a, b) => {
      if (packageSortBy === 'group') {
        const groupComp = (a.title || '').localeCompare(b.title || '', 'id');
        if (groupComp !== 0) return groupComp;
      }
      const isoA = normalizeDateToISO(a.departureDate) || a.departureDate || '';
      const isoB = normalizeDateToISO(b.departureDate) || b.departureDate || '';
      if (!isoA && !isoB) return (a.title || '').localeCompare(b.title || '', 'id');
      if (!isoA) return 1;
      if (!isoB) return -1;
      const timeA = new Date(isoA).getTime();
      const timeB = new Date(isoB).getTime();
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB;
      }
      return isoA.localeCompare(isoB);
    });

  const filteredPackages = sortedPackages.filter((p) => {
    if (categoryFilter === 'All') return true;
    const pCat = (p.category || '').toUpperCase();
    if (categoryFilter === 'UMRAH') {
      return pCat === 'UMRAH' || pCat === 'UMROH';
    }
    if (categoryFilter === 'HAJI') {
      return pCat === 'HAJI';
    }
    if (categoryFilter === 'HAJI KHUSUS') {
      return pCat === 'HAJI KHUSUS';
    }
    return pCat === categoryFilter;
  });

  const handleManualSync = async () => {
    if (!onSyncWithSeats) return;
    setIsSyncing(true);
    try {
      await onSyncWithSeats();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingPkg(null);
    setTitle('');
    setPackagePhoto('');
    if (activeSeats.length > 0) {
      const firstIso = normalizeDateToISO(activeSeats[0].departureDate);
      setDepartureDate(firstIso || '2026-10-05');
      setTitle(activeSeats[0].group || '');
      setCategory(getCategoryFromTitle(activeSeats[0].group || ''));
    } else {
      setDepartureDate('2026-10-05');
      setCategory('UMRAH');
    }
    setPrice(0);
    setDurationDays(11);
    setAirline(AIRLINES[0]);
    setDepartureAirport(DEPARTURE_AIRPORTS[0]);
    setArrivalAirport(ARRIVAL_AIRPORTS[0]);
    setMakkahHotelId(makkahHotels[0]?.id || '');
    setMakkahHotel2Id(makkahHotels[1]?.id || '');
    setMadinahHotelId(madinahHotels[0]?.id || '');
    setMadinahHotel2Id(madinahHotels[1]?.id || '');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: UmrahPackage) => {
    setEditingPkg(p);
    setTitle(p.title);
    setPackagePhoto(p.packagePhoto || '');
    const isoDate = normalizeDateToISO(p.departureDate) || p.departureDate;
    setDepartureDate(isoDate);
    const catNorm =
      p.category === 'Umroh'
        ? 'UMRAH'
        : p.category === 'Haji Khusus'
        ? 'HAJI KHUSUS'
        : (p.category as PackageCategoryType) || getCategoryFromTitle(p.title);
    setCategory(catNorm);
    setPrice(p.price || 0);
    setDurationDays(p.durationDays || 11);
    setAirline(p.airline || AIRLINES[0]);
    setDepartureAirport(p.departureAirport || DEPARTURE_AIRPORTS[0]);
    setArrivalAirport(p.arrivalAirport || ARRIVAL_AIRPORTS[0]);
    setMakkahHotelId(p.makkahHotelId || '');
    setMakkahHotel2Id(p.makkahHotel2Id || '');
    setMadinahHotelId(p.madinahHotelId || '');
    setMadinahHotel2Id(p.madinahHotel2Id || '');
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageFile(file, 1024, 800, 0.75);
        setPackagePhoto(compressedBase64);
      } catch (err) {
        console.warn('Error compressing image, fallback to standard reader:', err);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          setPackagePhoto(base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const makkahHotel = hotels.find((h) => h.id === makkahHotelId);
      const makkahHotel2 = hotels.find((h) => h.id === makkahHotel2Id);
      const madinahHotel = hotels.find((h) => h.id === madinahHotelId);
      const madinahHotel2 = hotels.find((h) => h.id === madinahHotel2Id);

      const resolvedDepartureDate =
        departureDate ||
        editingPkg?.departureDate ||
        editingPkg?.departureDates?.[0] ||
        '';

      const pkgPayload: UmrahPackage = {
        ...editingPkg,
        id: editingPkg ? editingPkg.id : `pkg-${Date.now()}`,
        title: title.trim(),
        packagePhoto: packagePhoto.trim(),
        departureDate: resolvedDepartureDate,
        departureDates: editingPkg?.departureDates || (resolvedDepartureDate ? [resolvedDepartureDate] : []),
        seatSchedules: editingPkg?.seatSchedules || [],
        category,
        price: Number(price) || 0,
        durationDays: Number(durationDays) || 11,
        airline: airline.trim(),
        departureAirport: departureAirport.trim(),
        arrivalAirport: arrivalAirport.trim(),
        makkahHotelId,
        makkahHotelName: makkahHotel?.name || '',
        distanceToKaaba: viewDistanceKaaba,
        makkahHotel2Id: makkahHotel2Id || '',
        makkahHotel2Name: makkahHotel2?.name || '',
        distanceToKaaba2: viewDistanceKaaba2 || '',
        madinahHotelId,
        madinahHotelName: madinahHotel?.name || '',
        distanceToNabawi: viewDistanceNabawi,
        madinahHotel2Id: madinahHotel2Id || '',
        madinahHotel2Name: madinahHotel2?.name || '',
        distanceToNabawi2: viewDistanceNabawi2 || '',
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
        createdAt: editingPkg?.createdAt || new Date().toISOString(),
      };

      await onSavePackage(pkgPayload);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving package:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAsNew = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const makkahHotel = hotels.find((h) => h.id === makkahHotelId);
      const makkahHotel2 = hotels.find((h) => h.id === makkahHotel2Id);
      const madinahHotel = hotels.find((h) => h.id === madinahHotelId);
      const madinahHotel2 = hotels.find((h) => h.id === madinahHotel2Id);

      const copyTitle = title.trim().includes('(Copy)') || title.trim().includes('(Salinan)')
        ? `${title.trim()} 2`
        : `${title.trim()} (Copy)`;

      const newPkgPayload: UmrahPackage = {
        id: `pkg-${Date.now()}`,
        title: copyTitle,
        packagePhoto: packagePhoto.trim(),
        departureDate,
        category,
        price: Number(price) || 0,
        durationDays: Number(durationDays) || 11,
        airline,
        departureAirport,
        arrivalAirport,
        makkahHotelId,
        makkahHotelName: makkahHotel?.name || 'Hotel Makkah 1',
        distanceToKaaba: viewDistanceKaaba,
        makkahHotel2Id: makkahHotel2Id || '',
        makkahHotel2Name: makkahHotel2?.name || '',
        distanceToKaaba2: viewDistanceKaaba2 || '',
        madinahHotelId,
        madinahHotelName: madinahHotel?.name || 'Hotel Madinah 1',
        distanceToNabawi: viewDistanceNabawi,
        madinahHotel2Id: madinahHotel2Id || '',
        madinahHotel2Name: madinahHotel2?.name || '',
        distanceToNabawi2: viewDistanceNabawi2 || '',
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await onSavePackage(newPkgPayload);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error copying package:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletePkgTarget) {
      await onDeletePackage(deletePkgTarget.id);
      setDeletePkgTarget(null);
    }
  };

  return (
    <section id="packages" className="pt-6 pb-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider">
                <Compass className="w-3.5 h-3.5 text-blue-700" />
                Group Database Paket
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                <Plane className="w-3 h-3 text-emerald-600" />
                Khusus Keberangkatan PLM & CGK
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Paket Haji & Umroh <br /> <span className="text-emerald-600 block sm:inline">Zafatour CGC</span>
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Data paket tersinkronisasi otomatis dari Seat Online Zafa Tour (khusus rute PLM & CGK).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <label htmlFor={pkgCategoryFilterId} className="sr-only">Filter Kategori Paket</label>
              {(['All', 'UMRAH', 'HAJI', 'HAJI KHUSUS'] as const).map((cat) => (
                <button
                  key={cat}
                  id={cat === 'All' ? pkgCategoryFilterId : undefined}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    categoryFilter === cat
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-slate-600 hover:text-blue-900'
                  }`}
                >
                  {cat === 'All' ? 'Semua Paket' : cat}
                </button>
              ))}
            </div>

            {/* Sort Toggle (Default: Group A-Z matching seat.zafatour.com) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPackageSortBy('group')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  packageSortBy === 'group'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-600 hover:text-blue-900'
                }`}
                title="Urutkan berdasarkan Group Nama Paket (A-Z) sesuai https://seat.zafatour.com/"
              >
                Sort: Group
              </button>
              <button
                type="button"
                onClick={() => setPackageSortBy('date')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  packageSortBy === 'date'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-600 hover:text-blue-900'
                }`}
                title="Urutkan berdasarkan Tanggal Keberangkatan"
              >
                Sort: Tanggal
              </button>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                {onSyncWithSeats && (
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    title="Sinkronkan Paket dari Seat Online"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Seat'}</span>
                  </button>
                )}

                <button
                  id="btn-add-package"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Paket</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <Plane className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Belum Ada Paket Haji & Umroh di Database</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Klik tombol <strong>&quot;Sinkronkan Seat&quot;</strong> untuk membaca dan membuat paket secara otomatis dari data Seat Online.
              </p>
              {isAdmin && onSyncWithSeats && (
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sinkronkan Sekarang dari Seat Online</span>
                </button>
              )}
            </div>
          ) : (
            filteredPackages.map((pkg) => {
              const makkahHotel = hotels.find((h) => h.id === pkg.makkahHotelId);
              const makkahHotel2 = pkg.makkahHotel2Id ? hotels.find((h) => h.id === pkg.makkahHotel2Id) : null;
              const madinahHotel = hotels.find((h) => h.id === pkg.madinahHotelId);
              const madinahHotel2 = pkg.madinahHotel2Id ? hotels.find((h) => h.id === pkg.madinahHotel2Id) : null;

              const distanceKaaba =
                pkg.distanceToKaaba ||
                (makkahHotel
                  ? getDistanceToKaaba(makkahHotel.mapUrl, makkahHotel.distanceToCenterMeters)
                  : '');

              const distanceKaaba2 =
                pkg.distanceToKaaba2 ||
                (makkahHotel2
                  ? getDistanceToKaaba(makkahHotel2.mapUrl, makkahHotel2.distanceToCenterMeters)
                  : '');

              const distanceNabawi =
                pkg.distanceToNabawi ||
                (madinahHotel
                  ? getDistanceToNabawi(madinahHotel.mapUrl, madinahHotel.distanceToCenterMeters)
                  : '');

              const distanceNabawi2 =
                pkg.distanceToNabawi2 ||
                (madinahHotel2
                  ? getDistanceToNabawi(madinahHotel2.mapUrl, madinahHotel2.distanceToCenterMeters)
                  : '');

              const matchingSchedules = getMatchingSeats(pkg);

              return (
                <div
                  key={pkg.id}
                  id={`card-package-${pkg.id}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col group"
                >
                  {/* Image & Badges */}
                  <div
                    className={`relative h-52 w-full bg-slate-800 overflow-hidden ${
                      pkg.packagePhoto ? 'cursor-pointer group/photo' : ''
                    }`}
                    onClick={() => {
                      if (pkg.packagePhoto) {
                        setPreviewImage({ url: pkg.packagePhoto, title: pkg.title });
                      }
                    }}
                    title={pkg.packagePhoto ? 'Klik untuk melihat foto penuh' : undefined}
                  >
                    {pkg.packagePhoto ? (
                      <>
                        <img
                          src={pkg.packagePhoto}
                          alt={pkg.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        {/* Hover hint for full photo */}
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                            <span>Lihat Foto Penuh</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 mb-2">
                          <Plane className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-bold text-white line-clamp-2 px-2">
                          {pkg.title}
                        </h4>
                        <span className="text-[10px] text-blue-200/70 mt-1">
                          Foto & data hotel dapat diunggah lewat menu edit
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none"></div>

                    {/* Category badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase bg-blue-900/90 text-white backdrop-blur-sm shadow-sm pointer-events-none">
                      {pkg.category}
                    </div>

                    {/* Duration badge if set */}
                    {pkg.durationDays > 0 && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm pointer-events-none">
                        {pkg.durationDays} Hari
                      </div>
                    )}

                    {/* Bottom banner info */}
                    <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 min-w-0 truncate">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span className="truncate">
                          {matchingSchedules.length > 0
                            ? `${matchingSchedules.length} Pilihan Tanggal`
                            : 'Paket Habis'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                        {pkg.title}
                      </h3>

                      {/* Dynamic Departure Dates from Seat Online (Tanggal-tanggal dari data seat) */}
                      {matchingSchedules.length === 0 ? (
                        <div className="mt-3 p-3 bg-red-50/90 border border-red-200 rounded-xl space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between text-xs font-bold text-red-950">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-red-700 shrink-0" />
                              <span>Jadwal Keberangkatan (Seat Online):</span>
                            </div>
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                              Paket Habis
                            </span>
                          </div>
                          <div className="py-2.5 px-3 bg-white rounded-lg border border-red-200 text-center shadow-xs">
                            <div className="flex items-center justify-center gap-1.5 text-red-700 font-bold text-xs">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                              <span>Paket Habis</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Tanggal keberangkatan pada seat online sudah tidak ada / selesai.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Jadwal Keberangkatan (Seat Online):</span>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900">
                              {matchingSchedules.length} Jadwal
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                            {matchingSchedules.map((sch, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/60 shadow-xs text-xs hover:border-amber-400 transition-colors"
                              >
                                <div className="flex items-center gap-2 text-slate-800 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                                  <span>{sch.departureDate}</span>
                                </div>
                                <span
                                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                                    sch.sisaSeat > 0
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-red-100 text-red-700 border border-red-200'
                                  }`}
                                >
                                  {sch.sisaSeat > 0 ? `Sisa ${sch.sisaSeat} Seat` : 'Seat Habis'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Flight & Airports Info */}
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs border border-slate-100">
                        {pkg.airline ? (
                          <>
                            <div className="flex items-center gap-2 font-semibold text-slate-800">
                              <Plane className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>{pkg.airline}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 pl-6 space-y-0.5">
                              <div>
                                <span className="text-slate-400">Rute:</span>{' '}
                                {pkg.departureAirport.split('(')[1]?.replace(')', '') || 'PLM'}{' '}
                                &rarr;{' '}
                                {pkg.arrivalAirport.includes('Jedah') ? 'Jeddah (JED)' : 'Madinah (MED)'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400 italic text-[11px]">
                            <Plane className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Maskapai & Rute belum diatur (Update via menu edit)</span>
                          </div>
                        )}
                      </div>

                      {/* Hotels & Distance Views */}
                      <div className="mt-3 space-y-2 text-xs">
                        {/* Hotel Makkah */}
                        {(pkg.makkahHotelName || makkahHotel) ? (
                          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-blue-950">
                                <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                <span>Makkah 1: {pkg.makkahHotelName || makkahHotel?.name}</span>
                              </div>
                              {distanceKaaba && (
                                <div className="text-[11px] text-blue-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>Jarak ke Ka&apos;bah: {distanceKaaba}</span>
                                </div>
                              )}
                            </div>

                            {(pkg.makkahHotel2Name || makkahHotel2) && (
                              <div className="pt-1.5 border-t border-blue-200/60">
                                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>Makkah 2: {pkg.makkahHotel2Name || makkahHotel2?.name}</span>
                                </div>
                                {distanceKaaba2 && (
                                  <div className="text-[11px] text-blue-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span>Jarak ke Ka&apos;bah: {distanceKaaba2}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Hotel Madinah */}
                        {(pkg.madinahHotelName || madinahHotel) ? (
                          <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                                <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>Madinah 1: {pkg.madinahHotelName || madinahHotel?.name}</span>
                              </div>
                              {distanceNabawi && (
                                <div className="text-[11px] text-emerald-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>Jarak ke Masjid Madinah: {distanceNabawi}</span>
                                </div>
                              )}
                            </div>

                            {(pkg.madinahHotel2Name || madinahHotel2) && (
                              <div className="pt-1.5 border-t border-emerald-200/60">
                                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Madinah 2: {pkg.madinahHotel2Name || madinahHotel2?.name}</span>
                                </div>
                                {distanceNabawi2 && (
                                  <div className="text-[11px] text-emerald-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span>Jarak ke Masjid Madinah: {distanceNabawi2}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {!pkg.makkahHotelName && !makkahHotel && !pkg.madinahHotelName && !madinahHotel && (
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 italic text-[11px] flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Hotel Makkah & Madinah belum diatur (Update via menu edit)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price & Admin Controls */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Harga Mulai
                        </div>
                        <div className="text-lg font-black text-blue-900">
                          {pkg.price > 0 ? formatCurrencyIDR(pkg.price) : 'Hubungi Kami'}
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(pkg)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Paket"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletePkgTarget({ id: pkg.id, title: pkg.title })}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Paket"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* In-App Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletePkgTarget)}
        onClose={() => setDeletePkgTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Paket Umroh / Haji"
        itemName={deletePkgTarget?.title || ''}
        itemType="paket"
      />

      {/* Full Photo Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-white/10 text-white">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm sm:text-base font-bold truncate text-slate-100">
                  {previewImage.title}
                </h3>
                <p className="text-[11px] text-slate-400">Foto Utama Brosur Paket (Klik di luar atau tombol silang untuk menutup)</p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                aria-label="Tutup preview foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 bg-black/50">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[78vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Admin CRUD Modal: Add / Edit Package */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900">
                {editingPkg ? 'Edit Paket Umroh/Haji' : 'Tambah Paket Umroh/Haji Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
              <div>
                <label htmlFor={pkgTitleInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Judul / Nama Paket *
                </label>
                <input
                  id={pkgTitleInputId}
                  type="text"
                  required
                  placeholder="Contoh: UMRAH REGULER MAHABBAH 11H (Direct GA PLM)"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setCategory(getCategoryFromTitle(e.target.value));
                  }}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama paket dari Seat Online. Kategori otomatis ditentukan dari 5 huruf pertama: <strong className="text-blue-700 font-bold">{category}</strong>.
                </p>
              </div>

              {/* Tampilkan info tanggal yang tersinkron jika ada */}
              {editingPkg && editingPkg.departureDates && editingPkg.departureDates.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    <span>Daftar Tanggal Keberangkatan Tersinkron dari Seat Online ({editingPkg.departureDates.length} tanggal):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editingPkg.departureDates.map((d, dIdx) => (
                      <span key={dIdx} className="px-2 py-0.5 bg-white border border-amber-300 text-amber-950 font-semibold rounded-md text-[11px]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor={pkgCategoryInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori *
                </label>
                <select
                  id={pkgCategoryInputId}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PackageCategoryType)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-800"
                >
                  <option value="UMRAH">UMRAH</option>
                  <option value="HAJI">HAJI</option>
                  <option value="HAJI KHUSUS">HAJI KHUSUS</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pilihan kategori: <strong className="text-blue-700 font-bold">UMRAH</strong>, <strong className="text-blue-700 font-bold">HAJI</strong>, atau <strong className="text-blue-700 font-bold">HAJI KHUSUS</strong>. Tanggal keberangkatan tersinkron otomatis dari data Seat Online.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={pkgPriceInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Paket (Rp) *
                  </label>
                  <input
                    id={pkgPriceInputId}
                    type="number"
                    required
                    step={100000}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={pkgDurationInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Durasi Hari Program
                  </label>
                  <input
                    id={pkgDurationInputId}
                    type="number"
                    min={9}
                    max={40}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

                <div>
                  <label htmlFor={pkgAirlineInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Maskapai Penerbangan *
                  </label>
                  <select
                    id={pkgAirlineInputId}
                    value={airline}
                    onChange={(e) => setAirline(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {AIRLINES.map((al) => (
                      <option key={al} value={al}>
                        {al}
                      </option>
                    ))}
                  </select>
                </div>

              {/* Bandara */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={pkgDepartureAirportInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Bandara Keberangkatan (Indonesia) *
                  </label>
                  <select
                    id={pkgDepartureAirportInputId}
                    value={departureAirport}
                    onChange={(e) => setDepartureAirport(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {DEPARTURE_AIRPORTS.map((air) => (
                      <option key={air} value={air}>
                        {air}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={pkgArrivalAirportInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Bandara Kedatangan (Arab Saudi) *
                  </label>
                  <select
                    id={pkgArrivalAirportInputId}
                    value={arrivalAirport}
                    onChange={(e) => setArrivalAirport(e.target.value as ArrivalAirportType)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {ARRIVAL_AIRPORTS.map((air) => (
                      <option key={air} value={air}>
                        {air}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hotel Picklists: 2 Hotels for Makkah & 2 Hotels for Madinah */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Hotel Makkah & Madinah (2 Hotel Tiap Kota)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 italic">
                    Diinfokan 2 nama hotel di Makkah dan 2 hotel di Madinah
                  </span>
                </div>

                {/* Hotel Makkah Section: 2 Hotels */}
                <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>Pilihan Hotel di Makkah (2 Hotel / Setaraf)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Hotel Makkah 1 */}
                    <div className="space-y-1.5">
                      <label htmlFor={pkgMakkahHotelInputId} className="block text-xs font-bold text-slate-700">
                        Nama Hotel Makkah 1 *
                      </label>
                      <select
                        id={pkgMakkahHotelInputId}
                        value={makkahHotelId}
                        onChange={(e) => setMakkahHotelId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="">-- Pilih Hotel Makkah 1 --</option>
                        {makkahHotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.stars}★)
                          </option>
                        ))}
                      </select>

                      <div className="p-2 bg-blue-100/70 border border-blue-200 rounded-lg text-xs">
                        <span className="text-slate-600 font-medium">Jarak ke Ka&apos;bah:</span>{' '}
                        <span className="font-bold text-blue-950">{viewDistanceKaaba}</span>
                      </div>
                    </div>

                    {/* Hotel Makkah 2 */}
                    <div className="space-y-1.5">
                      <label htmlFor={pkgMakkahHotel2InputId} className="block text-xs font-bold text-slate-700">
                        Nama Hotel Makkah 2 (Opsi / Hotel Kedua)
                      </label>
                      <select
                        id={pkgMakkahHotel2InputId}
                        value={makkahHotel2Id}
                        onChange={(e) => setMakkahHotel2Id(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="">-- Tidak Ada / 1 Hotel Saja --</option>
                        {makkahHotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.stars}★)
                          </option>
                        ))}
                      </select>

                      <div className="p-2 bg-blue-100/70 border border-blue-200 rounded-lg text-xs">
                        <span className="text-slate-600 font-medium">Jarak ke Ka&apos;bah:</span>{' '}
                        <span className="font-bold text-blue-950">
                          {viewDistanceKaaba2 || '(Belum dipilih)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hotel Madinah Section: 2 Hotels */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Pilihan Hotel di Madinah (2 Hotel / Setaraf)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Hotel Madinah 1 */}
                    <div className="space-y-1.5">
                      <label htmlFor={pkgMadinahHotelInputId} className="block text-xs font-bold text-slate-700">
                        Nama Hotel Madinah 1 *
                      </label>
                      <select
                        id={pkgMadinahHotelInputId}
                        value={madinahHotelId}
                        onChange={(e) => setMadinahHotelId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="">-- Pilih Hotel Madinah 1 --</option>
                        {madinahHotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.stars}★)
                          </option>
                        ))}
                      </select>

                      <div className="p-2 bg-emerald-100/70 border border-emerald-200 rounded-lg text-xs">
                        <span className="text-slate-600 font-medium">Jarak ke Masjid Madinah:</span>{' '}
                        <span className="font-bold text-emerald-950">{viewDistanceNabawi}</span>
                      </div>
                    </div>

                    {/* Hotel Madinah 2 */}
                    <div className="space-y-1.5">
                      <label htmlFor={pkgMadinahHotel2InputId} className="block text-xs font-bold text-slate-700">
                        Nama Hotel Madinah 2 (Opsi / Hotel Kedua)
                      </label>
                      <select
                        id={pkgMadinahHotel2InputId}
                        value={madinahHotel2Id}
                        onChange={(e) => setMadinahHotel2Id(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="">-- Tidak Ada / 1 Hotel Saja --</option>
                        {madinahHotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.stars}★)
                          </option>
                        ))}
                      </select>

                      <div className="p-2 bg-emerald-100/70 border border-emerald-200 rounded-lg text-xs">
                        <span className="text-slate-600 font-medium">Jarak ke Masjid Madinah:</span>{' '}
                        <span className="font-bold text-emerald-950">
                          {viewDistanceNabawi2 || '(Belum dipilih)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Foto Paket */}
              <div>
                <label htmlFor={pkgPhotoInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Foto / Banner Paket
                </label>
                <div className="flex gap-2">
                  <input
                    id={pkgPhotoInputId}
                    type="text"
                    placeholder="URL Gambar Banner Paket (https://...)"
                    value={packagePhoto}
                    onChange={(e) => setPackagePhoto(e.target.value)}
                    className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl shrink-0 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                {packagePhoto && (
                  <div className="mt-2 h-24 w-40 rounded-lg border border-slate-200 overflow-hidden">
                    <img
                      src={packagePhoto}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor={pkgNotesInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Fasilitas / Program
                </label>
                <textarea
                  id={pkgNotesInputId}
                  rows={2}
                  placeholder="Contoh: Penerbangan langsung direct PLM, manasik 3x di Palembang, fasilitas koper & perlengkapan eksklusif."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                {editingPkg && (
                  <button
                    type="button"
                    id="btn-copy-package"
                    onClick={handleCopyAsNew}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    title="Salin semua data dan foto sebagai paket baru"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-600" />
                    <span>Copy</span>
                  </button>
                )}
                <button
                  type="button"
                  id="btn-cancel-package"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="btn-save-package"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : editingPkg ? 'Simpan Perubahan' : 'Tambah Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
