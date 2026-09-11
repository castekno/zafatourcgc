import { useState, useId, FormEvent, ChangeEvent } from 'react';
import {
  Camera,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { DocumentationItem } from '../types';
import { compressImageFile } from '../utils/imageCompress';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface DocumentationSectionProps {
  documentations: DocumentationItem[];
  isAdmin: boolean;
  onSaveDoc: (item: DocumentationItem) => Promise<void>;
  onDeleteDoc: (id: string) => Promise<void>;
}

export default function DocumentationSection({
  documentations,
  isAdmin,
  onSaveDoc,
  onDeleteDoc,
}: DocumentationSectionProps) {
  const docTitleInputId = useId();
  const docDateInputId = useId();
  const docCategoryInputId = useId();
  const docDescriptionInputId = useId();
  const docMultiFileInputId = useId();

  // Viewer Modal State
  const [activeAlbum, setActiveAlbum] = useState<DocumentationItem | null>(null);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState<number>(0);

  // CRUD Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentationItem | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<{ id: string; title: string } | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [category, setCategory] = useState('Kegiatan Jamaah');
  const [description, setDescription] = useState('');
  
  // "bisa ditambahkan atau dikurangi secara otomatis tanpa menentukan jumlah foto"
  const [photosList, setPhotosList] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const handleOpenAdd = () => {
    setEditingDoc(null);
    setTitle('');
    setEventDate(new Date().toISOString().split('T')[0]);
    setCategory('Kegiatan Jamaah');
    setDescription('');
    setPhotosList(['']);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (docItem: DocumentationItem) => {
    setEditingDoc(docItem);
    setTitle(docItem.title);
    setEventDate(docItem.eventDate);
    setCategory(docItem.category || 'Kegiatan Jamaah');
    setDescription(docItem.description || '');
    setPhotosList(
      docItem.photos && docItem.photos.length > 0
        ? [...docItem.photos]
        : ['']
    );
    setIsFormOpen(true);
  };

  // Add a new photo row
  const handleAddPhotoRow = () => {
    setPhotosList((prev) => [...prev, '']);
  };

  // Remove a photo row
  const handleRemovePhotoRow = (index: number) => {
    setPhotosList((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next.length > 0 ? next : [''];
    });
  };

  // Change a single photo URL
  const handlePhotoChange = (index: number, val: string) => {
    setPhotosList((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  // Single file upload
  const handleSingleFileUpload = async (
    index: number,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageFile(file, 1024, 1024, 0.75);
        handlePhotoChange(index, compressedBase64);
      } catch (err) {
        console.warn('Error compressing image:', err);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          handlePhotoChange(index, base64);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Batch multi-file upload (appends automatically)
  const handleBatchFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(async (file: File) => {
      try {
        const compressedBase64 = await compressImageFile(file, 1024, 1024, 0.75);
        setPhotosList((prev) => {
          if (prev.length === 1 && prev[0] === '') {
            return [compressedBase64];
          }
          return [...prev, compressedBase64];
        });
      } catch (err) {
        console.warn('Error compressing image:', err);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          setPhotosList((prev) => {
            if (prev.length === 1 && prev[0] === '') {
              return [base64];
            }
            return [...prev, base64];
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const cleanedPhotos = photosList
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const docPayload: DocumentationItem = {
        id: editingDoc ? editingDoc.id : `doc-${Date.now()}`,
        title: title.trim(),
        eventDate,
        category,
        description: description.trim(),
        photos: cleanedPhotos,
        updatedAt: new Date().toISOString(),
        createdAt: editingDoc?.createdAt || new Date().toISOString(),
      };

      await onSaveDoc(docPayload);
      setIsFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteDocTarget) {
      await onDeleteDoc(deleteDocTarget.id);
      setDeleteDocTarget(null);
    }
  };

  const openAlbumViewer = (item: DocumentationItem) => {
    setActiveAlbum(item);
    setCurrentPhotoIdx(0);
  };

  return (
    <section id="documentation" className="py-16 bg-slate-50 border-t border-blue-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-2">
              <Camera className="w-3.5 h-3.5 text-blue-700" />
              Group Database Dokumentasi
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Galeri & Dokumentasi Jamaah
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Kenangan dan rekaman perjalanan ibadah jamaah Umroh & Haji
              ZafaTour Perwakilan Citragrand City Palembang.
            </p>
          </div>

          {isAdmin && (
            <button
              id="btn-add-doc"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all active:scale-95 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Dokumentasi</span>
            </button>
          )}
        </div>

        {/* Documentation Album Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documentations.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <Camera className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Belum Ada Data Dokumentasi di Database</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Foto dan dokumentasi perjalanan jamaah akan tampil otomatis dari database Firestore dbzafatourcgc.
              </p>
            </div>
          ) : (
            documentations.map((item) => {
              const coverPhoto =
                item.photos && item.photos.length > 0 ? item.photos[0] : '';
              const totalCount = item.photos ? item.photos.length : 0;

              return (
                <div
                  key={item.id}
                  id={`card-doc-${item.id}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer"
                  onClick={() => openAlbumViewer(item)}
                >
                  {/* Cover Image */}
                  <div className="relative h-56 w-full bg-slate-800 overflow-hidden">
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-800">
                        <Camera className="w-10 h-10 mb-2 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-300">Dokumentasi ZafaTour</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-900/90 text-white backdrop-blur-sm">
                      {item.category || 'Dokumentasi'}
                    </div>

                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      <span>{totalCount} Foto</span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between">
                      <div className="text-xs text-blue-200 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{item.eventDate}</span>
                      </div>
                      {/* Tulisan "DOKUMENTASI" pada Kanan Bawah Foto */}
                      <span className="px-2 py-0.5 rounded bg-blue-950/90 border border-amber-400/60 text-[10px] font-black tracking-wider text-amber-300 uppercase shadow-md">
                        DOKUMENTASI
                      </span>
                    </div>
                  </div>

                {/* Info & Description */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-hidden">
                    {item.photos.slice(0, 4).map((ph, pIdx) => (
                      <div
                        key={pIdx}
                        className="w-12 h-10 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-slate-200"
                      >
                        <img
                          src={ph}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                    {totalCount > 4 && (
                      <div className="w-12 h-10 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-[10px] font-black text-blue-800 shrink-0">
                        +{totalCount - 4}
                      </div>
                    )}

                    <div className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                      <span>Buka</span>
                    </div>
                  </div>

                  {/* Admin controls */}
                  {isAdmin && (
                    <div
                      className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteDocTarget({ id: item.id, title: item.title })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>

      {/* Lightbox Viewer Modal */}
      {activeAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative max-w-4xl w-full flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between text-white pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-bold">
                  {activeAlbum.title}
                </h4>
                <p className="text-xs text-slate-300">
                  Foto {currentPhotoIdx + 1} dari {activeAlbum.photos.length} • {activeAlbum.eventDate}
                </p>
              </div>
              <button
                onClick={() => setActiveAlbum(null)}
                className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main Picture Stage */}
            <div className="relative flex-1 flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden min-h-[300px] sm:min-h-[460px]">
              <img
                src={activeAlbum.photos[currentPhotoIdx]}
                alt="Dokumentasi Full Preview"
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />

              {/* Tulisan "DOKUMENTASI" pada Kanan Bawah Foto */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-amber-400/60 text-xs font-black tracking-widest text-amber-300 uppercase shadow-lg pointer-events-none">
                DOKUMENTASI
              </div>

              {/* Prev / Next controls */}
              {activeAlbum.photos.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentPhotoIdx((prev) =>
                        prev === 0 ? activeAlbum.photos.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPhotoIdx((prev) =>
                        prev === activeAlbum.photos.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails strip */}
            <div className="flex items-center gap-2 pt-3 overflow-x-auto max-w-full">
              {activeAlbum.photos.map((ph, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPhotoIdx(idx)}
                  className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                    currentPhotoIdx === idx
                      ? 'border-sky-400 scale-105 opacity-100'
                      : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={ph}
                    alt="Thumb"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin CRUD Modal: Dynamic Add / Edit Documentation */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900">
                {editingDoc ? 'Edit Album Dokumentasi' : 'Tambah Dokumentasi Baru'}
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
                <label htmlFor={docTitleInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Kegiatan Dokumentasi *
                </label>
                <input
                  id={docTitleInputId}
                  type="text"
                  required
                  placeholder="Contoh: Pelepasan Jamaah Umroh ZafaTour CGC di Bandara SMB II"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={docDateInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Kegiatan *
                  </label>
                  <input
                    id={docDateInputId}
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={docCategoryInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori / Label Kegiatan
                  </label>
                  <input
                    id={docCategoryInputId}
                    type="text"
                    placeholder="Contoh: Manasik, Keberangkatan, Tawaf, Ziarah"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={docDescriptionInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi / Keterangan Dokumentasi
                </label>
                <textarea
                  id={docDescriptionInputId}
                  rows={2}
                  placeholder="Tuliskan catatan, cerita, atau testimoni jamaah..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Dynamic Photo Manager: Tanpa menentukan batasan jumlah foto */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-blue-950 block">
                      Foto Dokumentasi ({photosList.length} Foto)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Bisa ditambahkan atau dikurangi secara dinamis tanpa batasan.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Batch Upload Multiple Files */}
                    <label htmlFor={docMultiFileInputId} className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Sekaligus</span>
                      <input
                        id={docMultiFileInputId}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleBatchFileUpload}
                      />
                    </label>

                    {/* Add Single Row */}
                    <button
                      type="button"
                      onClick={handleAddPhotoRow}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Baris</span>
                    </button>
                  </div>
                </div>

                {/* Photo Rows */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {photosList.map((photoUrl, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200"
                    >
                      <span className="text-xs font-bold text-slate-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Photo Thumbnail if available */}
                      {photoUrl ? (
                        <div className="w-12 h-10 rounded border border-slate-200 overflow-hidden shrink-0">
                          <img
                            src={photoUrl}
                            alt="thumb"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-10 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="URL Foto (https://...)"
                        value={photoUrl}
                        onChange={(e) => handlePhotoChange(idx, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />

                      <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded shrink-0">
                        <Upload className="w-3 h-3" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSingleFileUpload(idx, e)}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemovePhotoRow(idx)}
                        disabled={photosList.length <= 1}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 shrink-0"
                        title="Hapus foto ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                  {saving
                    ? 'Menyimpan...'
                    : editingDoc
                    ? 'Simpan Dokumentasi'
                    : 'Tambah Dokumentasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteDocTarget)}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Album Dokumentasi"
        itemName={deleteDocTarget?.title || ''}
        itemType="dokumentasi"
      />
    </section>
  );
}
