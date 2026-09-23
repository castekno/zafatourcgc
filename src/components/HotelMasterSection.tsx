import { useState, useId, FormEvent, ChangeEvent } from 'react';
import {
  Building2,
  MapPin,
  Star,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  X,
  Upload,
  Check,
} from 'lucide-react';
import { Hotel, CityType } from '../types';
import { getDistanceToKaaba, getDistanceToNabawi } from '../utils/distance';
import { compressImageFile } from '../utils/imageCompress';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface HotelMasterSectionProps {
  hotels: Hotel[];
  isAdmin: boolean;
  onSaveHotel: (hotel: Hotel) => Promise<void>;
  onDeleteHotel: (id: string) => Promise<void>;
}

export default function HotelMasterSection({
  hotels,
  isAdmin,
  onSaveHotel,
  onDeleteHotel,
}: HotelMasterSectionProps) {
  const hotelCityFilterId = useId();
  const hotelNameInputId = useId();
  const hotelCityInputId = useId();
  const hotelStarsInputId = useId();
  const hotelAddressInputId = useId();
  const hotelMapUrlInputId = useId();
  const hotelDistCenterInputId = useId();
  const hotelPhotoCountInputId = useId();

  const [cityFilter, setCityFilter] = useState<'All' | CityType>('All');
  const [activePhotoModal, setActivePhotoModal] = useState<Hotel | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // CRUD Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [deleteHotelTarget, setDeleteHotelTarget] = useState<{ id: string; name: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [city, setCity] = useState<CityType>('Makkah');
  const [stars, setStars] = useState<number>(5);
  const [address, setAddress] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [distanceToCenterMeters, setDistanceToCenterMeters] = useState<number>(100);
  
  // "ada pilihan jumlah foto yang akan diupload (sampai 6 foto)"
  const [photoCount, setPhotoCount] = useState<number>(3);
  const [photos, setPhotos] = useState<string[]>(['', '', '']);
  const [saving, setSaving] = useState(false);

  const filteredHotels = hotels.filter((h) => {
    if (cityFilter === 'All') return true;
    return h.city === cityFilter;
  });

  const handleOpenAdd = () => {
    setEditingHotel(null);
    setName('');
    setCity('Makkah');
    setStars(5);
    setAddress('');
    setMapUrl('');
    setDistanceToCenterMeters(100);
    setPhotoCount(3);
    setPhotos(['', '', '']);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (h: Hotel) => {
    setEditingHotel(h);
    setName(h.name);
    setCity(h.city);
    setStars(h.stars);
    setAddress(h.address);
    setMapUrl(h.mapUrl || '');
    setDistanceToCenterMeters(h.distanceToCenterMeters || 100);

    const existingPhotos = h.photos && h.photos.length > 0 ? h.photos : [''];
    const count = Math.min(Math.max(existingPhotos.length, 1), 6);
    setPhotoCount(count);
    
    // Fill to length of count
    const filledPhotos = [...existingPhotos];
    while (filledPhotos.length < count) {
      filledPhotos.push('');
    }
    setPhotos(filledPhotos.slice(0, count));
    setIsFormOpen(true);
  };

  const handlePhotoCountChange = (newCount: number) => {
    const count = Math.min(Math.max(newCount, 1), 6);
    setPhotoCount(count);
    setPhotos((prev) => {
      const next = [...prev];
      if (next.length < count) {
        while (next.length < count) next.push('');
      } else {
        next.splice(count);
      }
      return next;
    });
  };

  const handlePhotoUrlChange = (index: number, value: string) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleFileUpload = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageFile(file, 1024, 1024, 0.75);
        handlePhotoUrlChange(index, compressedBase64);
      } catch (err) {
        console.warn('Error compressing image, fallback to standard reader:', err);
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const base64 = uploadEvent.target?.result as string;
          handlePhotoUrlChange(index, base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const cleanedPhotos = photos
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const hotelPayload: Hotel = {
        id: editingHotel ? editingHotel.id : `hotel-${Date.now()}`,
        name: name.trim(),
        city,
        stars,
        address: address.trim(),
        photos: cleanedPhotos,
        mapUrl: mapUrl.trim(),
        distanceToCenterMeters: Number(distanceToCenterMeters) || 100,
        updatedAt: new Date().toISOString(),
        createdAt: editingHotel?.createdAt || new Date().toISOString(),
      };

      await onSaveHotel(hotelPayload);
      setIsFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteHotelTarget) {
      try {
        await onDeleteHotel(deleteHotelTarget.id);
      } finally {
        setDeleteHotelTarget(null);
      }
    }
  };

  return (
    <section id="hotels" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-2">
              <Building2 className="w-3.5 h-3.5 text-blue-700" />
              Master Hotel ZafaTour
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Hotel Rekanan Makkah & Madinah
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Akomodasi bintang 3 hingga 5 berstandar internasional dengan jarak
              dekat ke Ka&apos;bah dan pelataran Masjid Nabawi.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <label htmlFor={hotelCityFilterId} className="sr-only">Filter Kota</label>
              {(['All', 'Makkah', 'Madinah'] as const).map((c) => (
                <button
                  key={c}
                  id={c === 'All' ? hotelCityFilterId : undefined}
                  onClick={() => setCityFilter(c)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    cityFilter === c
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-slate-600 hover:text-blue-900'
                  }`}
                >
                  {c === 'All' ? 'Semua Kota' : c}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                id="btn-add-hotel"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Hotel</span>
              </button>
            )}
          </div>
        </div>

        {/* Hotel Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHotels.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Belum Ada Data Hotel di Database</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Data master hotel Makkah dan Madinah akan tampil otomatis dari database Firestore dbzafatourcgc.
              </p>
            </div>
          ) : (
            filteredHotels.map((hotel) => {
              const coverPhoto =
                hotel.photos && hotel.photos.length > 0 ? hotel.photos[0] : '';
              const photoCountTotal = hotel.photos ? hotel.photos.length : 0;
              const distanceText =
                hotel.city === 'Makkah'
                  ? getDistanceToKaaba(hotel.mapUrl, hotel.distanceToCenterMeters)
                  : getDistanceToNabawi(hotel.mapUrl, hotel.distanceToCenterMeters);

              return (
                <div
                  key={hotel.id}
                  id={`card-hotel-${hotel.id}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                >
                  {/* Image Cover with badges */}
                  <div className="relative h-48 w-full bg-slate-800 overflow-hidden">
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt={hotel.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-800">
                        <Building2 className="w-10 h-10 mb-2 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-300">{hotel.name}</span>
                      </div>
                    )}

                  {/* City badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase bg-blue-900/90 text-white backdrop-blur-sm shadow-sm">
                    {hotel.city}
                  </div>

                  {/* Star rating */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold shadow-sm">
                    <Star className="w-3.5 h-3.5 fill-white" />
                    <span>{hotel.stars} Bintang</span>
                  </div>

                  {/* Photo count button */}
                  {photoCountTotal > 0 && (
                    <button
                      onClick={() => {
                        setActivePhotoModal(hotel);
                        setSelectedPhotoIndex(0);
                      }}
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-sm transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{photoCountTotal} Foto</span>
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {hotel.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-start gap-1 line-clamp-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{hotel.address}</span>
                    </p>
                  </div>

                  {/* Distance Indicator */}
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">
                      Jarak ke Pusat:
                    </span>
                    <span className="font-bold text-blue-900 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                      {distanceText}
                    </span>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {hotel.mapUrl ? (
                      <a
                        href={hotel.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka di Google Maps</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Peta belum ditautkan
                      </span>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(hotel)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Hotel"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteHotelTarget({ id: hotel.id, name: hotel.name })}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Hotel"
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

      {/* Photo Carousel Modal */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm sm:text-base">
                  {activePhotoModal.name} - Galeri ({activePhotoModal.photos.length} Foto)
                </h4>
                <p className="text-xs text-slate-400">{activePhotoModal.city}</p>
              </div>
              <button
                onClick={() => setActivePhotoModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex flex-col items-center">
              <div className="h-72 sm:h-96 w-full flex items-center justify-center">
                <img
                  src={activePhotoModal.photos[selectedPhotoIndex]}
                  alt="Hotel Preview"
                  className="max-h-full max-w-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Thumbnails */}
              <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-full pb-2">
                {activePhotoModal.photos.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative w-16 h-12 rounded-md overflow-hidden shrink-0 border-2 transition-all ${
                      selectedPhotoIndex === idx
                        ? 'border-sky-400 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={p}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin CRUD Modal: Add / Edit Hotel */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900">
                {editingHotel ? 'Edit Master Hotel' : 'Tambah Master Hotel Baru'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
              <div>
                <label htmlFor={hotelNameInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Hotel *
                </label>
                <input
                  id={hotelNameInputId}
                  type="text"
                  required
                  placeholder="Contoh: Pullman Zamzam Makkah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={hotelCityInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Kota Hotel *
                  </label>
                  <select
                    id={hotelCityInputId}
                    value={city}
                    onChange={(e) => setCity(e.target.value as CityType)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Makkah">Makkah</option>
                    <option value="Madinah">Madinah</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={hotelStarsInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Klasifikasi Bintang *
                  </label>
                  <select
                    id={hotelStarsInputId}
                    value={stars}
                    onChange={(e) => setStars(Number(e.target.value))}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value={5}>Bintang 5 (★★★★★)</option>
                    <option value={4}>Bintang 4 (★★★★)</option>
                    <option value={3}>Bintang 3 (★★★)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={hotelAddressInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Hotel *
                </label>
                <textarea
                  id={hotelAddressInputId}
                  rows={2}
                  required
                  placeholder="Contoh: Abraj Al Bait Complex, King Abdul Aziz Endowment, Makkah"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={hotelMapUrlInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    URL Google Maps
                  </label>
                  <input
                    id={hotelMapUrlInputId}
                    type="url"
                    placeholder="https://maps.google.com/?q=..."
                    value={mapUrl}
                    onChange={(e) => setMapUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={hotelDistCenterInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Jarak ke Ka&apos;bah/Nabawi (meter)
                  </label>
                  <input
                    id={hotelDistCenterInputId}
                    type="number"
                    min={10}
                    max={5000}
                    value={distanceToCenterMeters}
                    onChange={(e) => setDistanceToCenterMeters(Number(e.target.value))}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pilihan Jumlah Foto yang Akan Diupload (Sampai 6 foto) */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor={hotelPhotoCountInputId} className="text-xs font-bold text-blue-950">
                    Foto Hotel (Pilih Jumlah Foto: 1 s/d 6 Foto)
                  </label>
                  <div className="flex items-center gap-1">
                    <label htmlFor={hotelPhotoCountInputId} className="text-xs text-slate-500">Jumlah:</label>
                    <select
                      id={hotelPhotoCountInputId}
                      value={photoCount}
                      onChange={(e) => handlePhotoCountChange(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-900"
                    >
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <option key={num} value={num}>
                          {num} Foto
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dynamic photo inputs according to chosen photoCount */}
                <div className="space-y-3">
                  {photos.slice(0, photoCount).map((p, idx) => (
                    <div key={idx} className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>Foto ke-{idx + 1}</span>
                        {p && <span className="text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Ada</span>}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Masukkan URL Foto (https://...)"
                          value={p}
                          onChange={(e) => handlePhotoUrlChange(idx, e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                        <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg shrink-0 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(idx, e)}
                          />
                        </label>
                      </div>

                      {p && (
                        <div className="mt-1 h-16 w-24 rounded border border-slate-200 overflow-hidden">
                          <img
                            src={p}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : editingHotel ? 'Simpan Perubahan' : 'Tambah Hotel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteHotelTarget)}
        onClose={() => setDeleteHotelTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Hotel Rekanan"
        itemName={deleteHotelTarget?.name || ''}
        itemType="hotel"
      />
    </section>
  );
}
