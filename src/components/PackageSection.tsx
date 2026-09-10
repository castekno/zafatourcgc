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
  MessageCircle,
  X,
  Compass,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { UmrahPackage, Hotel, ArrivalAirportType, SeatInfo } from '../types';
import {
  AIRLINES,
  DEPARTURE_AIRPORTS,
  ARRIVAL_AIRPORTS,
} from '../data/constants';
import { formatCurrencyIDR, getDistanceToKaaba, getDistanceToNabawi } from '../utils/distance';
import { checkSeatAvailability, normalizeDateToISO } from '../utils/seatSync';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface PackageSectionProps {
  packages: UmrahPackage[];
  hotels: Hotel[];
  seats?: SeatInfo[];
  isAdmin: boolean;
  onSavePackage: (pkg: UmrahPackage) => Promise<void>;
  onDeletePackage: (id: string) => Promise<void>;
}

export default function PackageSection({
  packages,
  hotels,
  seats = [],
  isAdmin,
  onSavePackage,
  onDeletePackage,
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

  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Umroh' | 'Haji Khusus'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<UmrahPackage | null>(null);
  const [deletePkgTarget, setDeletePkgTarget] = useState<{ id: string; title: string } | null>(null);

  // Local active seats state (synced with props or fetched as fallback)
  const [activeSeats, setActiveSeats] = useState<SeatInfo[]>(seats);

  useEffect(() => {
    if (seats && seats.length > 0) {
      setActiveSeats(seats);
    } else {
      fetch('/api/seats')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setActiveSeats(data.data.filter((s: SeatInfo) => s.sisaSeat > 0));
          }
        })
        .catch((err) => console.warn('Could not load seats for sync:', err));
    }
  }, [seats]);

  // Form states
  const [title, setTitle] = useState('');
  const [packagePhoto, setPackagePhoto] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [category, setCategory] = useState<'Umroh' | 'Haji Khusus'>('Umroh');
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

  // Live real-time check between departureDate and available seats
  const seatCheck = checkSeatAvailability(departureDate, activeSeats);

  // Otomatis urutkan paket berdasarkan Tanggal Berangkat (Ascending: tanggal paling dekat di awal)
  const sortedPackages = [...packages].sort((a, b) => {
    const isoA = normalizeDateToISO(a.departureDate) || a.departureDate || '';
    const isoB = normalizeDateToISO(b.departureDate) || b.departureDate || '';
    const timeA = new Date(isoA).getTime();
    const timeB = new Date(isoB).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      return timeA - timeB;
    }
    return isoA.localeCompare(isoB);
  });

  const filteredPackages = sortedPackages.filter((p) => {
    if (categoryFilter === 'All') return true;
    return p.category === categoryFilter;
  });

  const handleOpenAdd = () => {
    setEditingPkg(null);
    setTitle('');
    setPackagePhoto('');
    // Pre-select first available seat schedule date if available
    if (activeSeats.length > 0) {
      const firstIso = normalizeDateToISO(activeSeats[0].departureDate);
      setDepartureDate(firstIso || '2026-10-05');
    } else {
      setDepartureDate('2026-10-05');
    }
    setCategory('Umroh');
    setPrice(32500000);
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
    setPackagePhoto(p.packagePhoto);
    const isoDate = normalizeDateToISO(p.departureDate) || p.departureDate;
    setDepartureDate(isoDate);
    setCategory(p.category);
    setPrice(p.price);
    setDurationDays(p.durationDays);
    setAirline(p.airline);
    setDepartureAirport(p.departureAirport);
    setArrivalAirport(p.arrivalAirport);
    setMakkahHotelId(p.makkahHotelId || '');
    setMakkahHotel2Id(p.makkahHotel2Id || '');
    setMadinahHotelId(p.madinahHotelId || '');
    setMadinahHotel2Id(p.madinahHotel2Id || '');
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setPackagePhoto(base64);
      };
      reader.readAsDataURL(file);
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

      const pkgPayload: UmrahPackage = {
        id: editingPkg ? editingPkg.id : `pkg-${Date.now()}`,
        title: title.trim(),
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

  const handleBookingWA = (pkg: UmrahPackage) => {
    const makkah1 = pkg.makkahHotelName || 'Hotel Rekanan';
    const makkahText = pkg.makkahHotel2Name
      ? `${makkah1} & ${pkg.makkahHotel2Name}`
      : makkah1;
    const madinah1 = pkg.madinahHotelName || 'Hotel Rekanan';
    const madinahText = pkg.madinahHotel2Name
      ? `${madinah1} & ${pkg.madinahHotel2Name}`
      : madinah1;

    const text = encodeURIComponent(
      `Assalamu'alaikum ZafaTour CGC Palembang, saya tertarik berkonsultasi mengenai paket:\n\n*${pkg.title}*\nTanggal Berangkat: ${pkg.departureDate}\nMaskapai: ${pkg.airline}\nHotel Makkah (2 Hotel): ${makkahText} (${pkg.distanceToKaaba || 'Dekat'})\nHotel Madinah (2 Hotel): ${madinahText} (${pkg.distanceToNabawi || 'Dekat'})\nHarga: ${formatCurrencyIDR(pkg.price)}\n\nMohon informasi brosur & ketersediaan seat.`
    );
    window.open(`https://wa.me/62811715608?text=${text}`, '_blank');
  };

  return (
    <section id="packages" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-2">
              <Compass className="w-3.5 h-3.5 text-blue-700" />
              Group Database Paket
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Paket Haji & Umroh ZafaTour CGC
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Pilihan program ibadah terpercaya dengan rute langsung, hotel
              berbintang, dan bimbingan manasik komprehensif.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200/80 rounded-xl text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Urutan: Tanggal Berangkat (Otomatis)</span>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <label htmlFor={pkgCategoryFilterId} className="sr-only">Filter Kategori Paket</label>
              {(['All', 'Umroh', 'Haji Khusus'] as const).map((cat) => (
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

            {isAdmin && (
              <button
                id="btn-add-package"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Paket</span>
              </button>
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
                Daftar paket perjalanan haji dan umroh akan tampil otomatis saat tersedia di database Firestore dbzafatourcgc.
              </p>
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
                  : 'Dekat Ka\'bah');

              const distanceKaaba2 =
                pkg.distanceToKaaba2 ||
                (makkahHotel2
                  ? getDistanceToKaaba(makkahHotel2.mapUrl, makkahHotel2.distanceToCenterMeters)
                  : '');

              const distanceNabawi =
                pkg.distanceToNabawi ||
                (madinahHotel
                  ? getDistanceToNabawi(madinahHotel.mapUrl, madinahHotel.distanceToCenterMeters)
                  : 'Dekat Masjid Nabawi');

              const distanceNabawi2 =
                pkg.distanceToNabawi2 ||
                (madinahHotel2
                  ? getDistanceToNabawi(madinahHotel2.mapUrl, madinahHotel2.distanceToCenterMeters)
                  : '');

              return (
                <div
                  key={pkg.id}
                  id={`card-package-${pkg.id}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col group"
                >
                  {/* Image & Badges */}
                  <div className="relative h-52 w-full bg-slate-800 overflow-hidden">
                    {pkg.packagePhoto ? (
                      <img
                        src={pkg.packagePhoto}
                        alt={pkg.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-800">
                        <Plane className="w-10 h-10 mb-2 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-300">{pkg.title}</span>
                      </div>
                    )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>

                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase bg-blue-900/90 text-white backdrop-blur-sm shadow-sm">
                    {pkg.category}
                  </div>

                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm">
                    {pkg.durationDays} Hari Program
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5 min-w-0 truncate">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Berangkat: {pkg.departureDate}</span>
                    </div>
                    {(() => {
                      const matched = activeSeats.find((s) => {
                        const iso = normalizeDateToISO(s.departureDate);
                        const pkgIso = normalizeDateToISO(pkg.departureDate);
                        return (iso && pkgIso && iso === pkgIso) || s.departureDate.includes(pkg.departureDate);
                      });

                      const isAvailable = matched && matched.sisaSeat > 0;

                      if (isAvailable) {
                        return (
                          <span
                            id={`seat-badge-available-${pkg.id}`}
                            className="text-[10px] font-bold bg-emerald-500/95 text-white px-2 py-0.5 rounded-full shadow shrink-0 whitespace-nowrap"
                          >
                            Sisa {matched.sisaSeat} Seat
                          </span>
                        );
                      }

                      // Jika seat habis (0) atau tidak ada data seat pada tanggal berangkat yang tertulis
                      return (
                        <span
                          id={`seat-badge-soldout-${pkg.id}`}
                          className="text-[10px] font-extrabold text-white bg-red-600 animate-blink-red px-2 py-0.5 rounded-full shadow-md shrink-0 whitespace-nowrap flex items-center gap-1"
                          title="Seat telah habis atau belum tersedia untuk tanggal keberangkatan ini"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                          <span>Seat Habis</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                      {pkg.title}
                    </h3>

                    {/* Flight & Airports Info */}
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-100">
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
                        <div className="text-slate-500 truncate">
                          Kedatangan: {pkg.arrivalAirport}
                        </div>
                      </div>
                    </div>

                    {/* Hotels & Distance Views */}
                    <div className="mt-3 space-y-2 text-xs">
                      {/* Hotel Makkah (1 & 2) */}
                      <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1.5">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-blue-950">
                            <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span>Makkah 1: {pkg.makkahHotelName || makkahHotel?.name || 'Hotel Rekanan'}</span>
                          </div>
                          <div className="text-[11px] text-blue-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>Jarak ke Ka&apos;bah: {distanceKaaba}</span>
                          </div>
                        </div>

                        {(pkg.makkahHotel2Name || makkahHotel2) && (
                          <div className="pt-1.5 border-t border-blue-200/60">
                            <div className="flex items-center gap-1.5 font-bold text-blue-900">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Makkah 2: {pkg.makkahHotel2Name || makkahHotel2?.name}</span>
                            </div>
                            <div className="text-[11px] text-blue-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>Jarak ke Ka&apos;bah: {distanceKaaba2 || 'Dekat Ka\'bah'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hotel Madinah (1 & 2) */}
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1.5">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                            <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Madinah 1: {pkg.madinahHotelName || madinahHotel?.name || 'Hotel Rekanan'}</span>
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>Jarak ke Masjid Madinah: {distanceNabawi}</span>
                          </div>
                        </div>

                        {(pkg.madinahHotel2Name || madinahHotel2) && (
                          <div className="pt-1.5 border-t border-emerald-200/60">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Madinah 2: {pkg.madinahHotel2Name || madinahHotel2?.name}</span>
                            </div>
                            <div className="text-[11px] text-emerald-700 font-semibold pl-5 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>Jarak ke Masjid Madinah: {distanceNabawi2 || 'Dekat Masjid Madinah'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Harga Mulai
                      </div>
                      <div className="text-lg font-black text-blue-900">
                        {formatCurrencyIDR(pkg.price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        id={`btn-wa-pkg-${pkg.id}`}
                        onClick={() => handleBookingWA(pkg)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Daftar</span>
                      </button>

                      {isAdmin && (
                        <div className="flex items-center gap-1 pl-1">
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
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={pkgCategoryInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori *
                  </label>
                  <select
                    id={pkgCategoryInputId}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Umroh">Umroh</option>
                    <option value="Haji Khusus">Haji Khusus</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={pkgDepartureDateInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Berangkat *
                  </label>

                  {/* Seat Quick Sync Selector */}
                  {activeSeats.length > 0 && (
                    <div className="mb-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setDepartureDate(e.target.value);
                          }
                        }}
                        className="w-full text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      >
                        <option value="">-- Sinkronkan dari Jadwal Seat Tersedia ({activeSeats.length} jadwal) --</option>
                        {activeSeats.map((s, idx) => {
                          const isoDate = normalizeDateToISO(s.departureDate);
                          return (
                            <option key={`${s.no}-${idx}`} value={isoDate || s.departureDate}>
                              {s.departureDate} — Sisa {s.sisaSeat} Kursi ({s.group})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  <input
                    id={pkgDepartureDateInputId}
                    type="date"
                    required
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />

                  {/* Real-time synchronization message:
                      "jika tidak ada maka akan muncul pesan Tanggal tidak ada. jika ada maka akan muncul pesan sisa kursi." */}
                  {departureDate && (
                    <div className="mt-2">
                      {seatCheck.isMatched ? (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Sisa kursi: <strong className="text-emerald-950 font-bold">{seatCheck.matchedSeat?.sisaSeat} kursi</strong> ({seatCheck.matchedSeat?.group})
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-medium animate-in fade-in">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            <strong className="font-bold text-rose-950">Tanggal tidak ada</strong> pada jadwal seat yang tersedia (seat.zafatour.com)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
