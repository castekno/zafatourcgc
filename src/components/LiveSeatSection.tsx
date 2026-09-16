import { useState, useEffect, useId } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  ExternalLink,
  Calendar,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SeatInfo } from '../types';
import { fetchLiveSeatData, sortSeatsByGroup, isHajiKhususKemenag } from '../services/seatService';

type SortField = 'group' | 'no' | 'departureDate' | 'sisaSeat';
type SortDirection = 'asc' | 'desc';

export default function LiveSeatSection() {
  const searchInputId = useId();
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [officialUpdate, setOfficialUpdate] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sorting state - DEFAULT: Sort by Group (A-Z) as requested
  const [sortBy, setSortBy] = useState<SortField>('group');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter category
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'UMRAH' | 'HAJI KHUSUS'>('ALL');

  const fetchSeatData = async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Coba fetch API langsung untuk mendapatkan timestamp website resmi jika tersedia
      try {
        const apiRes = await fetch(`/api/seats?t=${Date.now()}`, { cache: 'no-cache' });
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.officialUpdate) {
            setOfficialUpdate(json.officialUpdate);
          }
        }
      } catch {
        // Abaikan jika info update tidak didapat
      }

      const data = await fetchLiveSeatData(forceRefresh);
      // Pastikan hanya data dengan sisa seat > 0 dan BUKAN haji khusus kemenag
      const filtered = data.filter((s: SeatInfo) => s.sisaSeat > 0 && !isHajiKhususKemenag(s.group));
      setSeats(filtered);
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengambil data kursi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Selalu ambil data live terbaru saat web dibuka / refresh
    fetchSeatData(true);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Filter pencarian dan kategori
  const filteredSeats = seats.filter((s) => {
    const matchSearch =
      s.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.departureDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.no).includes(searchTerm);

    if (!matchSearch) return false;

    if (selectedCategory === 'HAJI KHUSUS') {
      return s.group.toUpperCase().includes('HAJI');
    }
    if (selectedCategory === 'UMRAH') {
      return !s.group.toUpperCase().includes('HAJI');
    }
    return true;
  });

  // Terapkan sorting (Default: Sort by Group)
  const sortedSeats = [...filteredSeats].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'group') {
      comparison = a.group.localeCompare(b.group, 'id');
      if (comparison === 0) comparison = a.no - b.no;
    } else if (sortBy === 'no') {
      comparison = a.no - b.no;
    } else if (sortBy === 'sisaSeat') {
      comparison = a.sisaSeat - b.sisaSeat;
    } else if (sortBy === 'departureDate') {
      comparison = a.departureDate.localeCompare(b.departureDate, 'id');
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Statistik ringkas
  const totalAvailableSeats = seats.reduce((acc, curr) => acc + curr.sisaSeat, 0);
  const uniqueGroups = new Set(seats.map((s) => s.group.trim())).size;

  return (
    <section id="seats" className="py-16 bg-gradient-to-b from-slate-50 to-blue-50/40 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Data Terintegrasi
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Sisa Seat Tersedia (ZafaTour)
            </h2>

            {officialUpdate && (
              <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Update Web Sumber: <strong className="text-slate-700">{officialUpdate}</strong></span>
              </div>
            )}
          </div>

          {/* Action & Stats Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {lastUpdated && (
              <div className="text-xs text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs font-medium">
                Sinkronisasi: <span className="font-bold text-slate-800">{lastUpdated} WIB</span>
              </div>
            )}
            <button
              id="btn-refresh-seats"
              onClick={() => fetchSeatData(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 active:scale-98 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sisa Seat</div>
            <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-1 flex items-baseline gap-1.5">
              <span>{totalAvailableSeats}</span>
              <span className="text-xs font-semibold text-slate-500">Kursi Tersedia</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jadwal Keberangkatan</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
              <span>{seats.length}</span>
              <span className="text-xs font-semibold text-slate-500">Jadwal Aktif</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Group Paket</div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 flex items-baseline gap-1.5">
              <span>{uniqueGroups}</span>
              <span className="text-xs font-semibold text-slate-500">Nama Group Unik</span>
            </div>
          </div>
        </div>

        {/* Filter & Sort Bar */}
        <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <label htmlFor={searchInputId} className="sr-only">Cari paket atau tanggal</label>
            <input
              id={searchInputId}
              type="text"
              placeholder="Cari nama group paket, no, atau tanggal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 shadow-xs transition-all"
            />
          </div>

          {/* Category Filter Pills & Sort Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-white text-blue-700 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({seats.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('UMRAH')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedCategory === 'UMRAH'
                    ? 'bg-white text-blue-700 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Umrah
              </button>
              {seats.some((s) => s.group.toUpperCase().includes('HAJI')) && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('HAJI KHUSUS')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedCategory === 'HAJI KHUSUS'
                      ? 'bg-white text-blue-700 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Haji Khusus
                </button>
              )}
            </div>

            {/* Quick Button to Reset to Sort by Group */}
            <button
              type="button"
              onClick={() => {
                setSortBy('group');
                setSortDirection('asc');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                sortBy === 'group' && sortDirection === 'asc'
                  ? 'bg-blue-50 text-blue-700 border-blue-300 font-black ring-1 ring-blue-400'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Sort by Group (A-Z)</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        {loading && seats.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <RefreshCw className="w-9 h-9 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-slate-800 font-bold text-sm">
              Menghubungkan ke sistem https://seat.zafatour.com/...
            </p>
            <p className="text-slate-500 text-xs mt-1">Mengambil data ketersediaan kursi terbaru secara langsung.</p>
          </div>
        ) : errorMsg && seats.length === 0 ? (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Gagal Mengambil Data Live</div>
              <div className="text-xs mt-1 text-amber-700">{errorMsg}</div>
            </div>
          </div>
        ) : sortedSeats.length === 0 ? (
          <div className="py-14 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-slate-600 font-semibold text-sm">
              Tidak ada jadwal dengan sisa kursi &gt; 0 yang cocok dengan pencarian &quot;{searchTerm}&quot;.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table id="table-seats-data" className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider select-none">
                    {/* Kolom No */}
                    <th
                      onClick={() => handleSort('no')}
                      className="py-3.5 px-4 w-16 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                      title="Urutkan berdasarkan nomor baris asli di web zafatour"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>No</span>
                        {sortBy === 'no' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>

                    {/* Kolom Group */}
                    <th
                      onClick={() => handleSort('group')}
                      className="py-3.5 px-4 cursor-pointer hover:bg-slate-200 transition-colors bg-blue-50/60"
                      title="Urutkan berdasarkan nama Group paket (A-Z)"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-blue-900 font-black">Group / Paket Umroh & Haji</span>
                        {sortBy === 'group' ? (
                          sortDirection === 'asc' ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-600 text-white">
                              A-Z <ArrowUp className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-600 text-white">
                              Z-A <ArrowDown className="w-3 h-3" />
                            </span>
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </th>

                    {/* Kolom Tanggal Keberangkatan */}
                    <th
                      onClick={() => handleSort('departureDate')}
                      className="py-3.5 px-4 cursor-pointer hover:bg-slate-200 transition-colors"
                      title="Urutkan berdasarkan tanggal keberangkatan"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Tanggal Berangkat</span>
                        {sortBy === 'departureDate' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>

                    {/* Kolom Sisa Seat */}
                    <th
                      onClick={() => handleSort('sisaSeat')}
                      className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-200 transition-colors w-36"
                      title="Urutkan berdasarkan sisa seat"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Sisa Seat</span>
                        {sortBy === 'sisaSeat' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSeats.map((item, idx) => {
                    const isHaji = item.group.toUpperCase().includes('HAJI');
                    return (
                      <tr
                        key={`${item.no}-${item.departureDate}-${idx}`}
                        className="hover:bg-blue-50/60 transition-colors"
                      >
                        {/* No baris asli dari zafatour */}
                        <td className="py-4 px-4 text-center font-bold text-slate-400 text-xs">
                          <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-mono">
                            {item.no}
                          </span>
                        </td>

                        {/* Nama Group */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                            <span className="font-bold text-slate-900 tracking-tight">
                              {item.group}
                            </span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider w-fit ${
                                isHaji
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {isHaji ? 'Haji Khusus' : 'Umrah'}
                            </span>
                          </div>
                        </td>

                        {/* Tanggal Berangkat */}
                        <td className="py-4 px-4 text-slate-700 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>{item.departureDate}</span>
                          </div>
                        </td>

                        {/* Sisa Seat (>0) */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs ${
                              item.sisaSeat >= 15
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : item.sisaSeat >= 5
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>{item.sisaSeat} Kursi</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <div>
                Menampilkan <strong className="text-slate-800">{sortedSeats.length}</strong> dari{' '}
                <strong className="text-slate-800">{seats.length}</strong> jadwal dengan sisa kursi &gt; 0
              </div>
              <div className="text-[11px] text-slate-500 italic">
                * Sumber resmi:{' '}
                <a
                  href="https://seat.zafatour.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  seat.zafatour.com
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
