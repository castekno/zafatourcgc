import { useState, useEffect, useId } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Calendar,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { SeatInfo } from '../types';
import { fetchLiveSeatData } from '../services/seatService';

export default function LiveSeatSection() {
  const searchInputId = useId();
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSeatData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchLiveSeatData();
      const filtered = data.filter((s: SeatInfo) => s.sisaSeat > 0);
      setSeats(filtered);
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengambil data kursi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeatData();
  }, []);

  const filteredSeats = seats.filter(
    (s) =>
      s.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.departureDate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBookingWA = (seat: SeatInfo) => {
    const text = encodeURIComponent(
      `Halo ZafaTour Perwakilan CGC Palembang, saya berminat mendaftar untuk:\n\n*Group:* ${seat.group}\n*Tanggal Berangkat:* ${seat.departureDate}\n*Sisa Seat:* ${seat.sisaSeat} kursi\n\nMohon info ketersediaan dan syarat pendaftaran.`
    );
    window.open(`https://wa.me/62811715608?text=${text}`, '_blank');
  };

  return (
    <section id="seats" className="py-16 bg-slate-50 border-y border-blue-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Database Integration
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Sisa Seat Tersedia (ZafaTour)
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Data kursi keberangkatan Umroh & Haji langsung dari sistem{' '}
              <a
                href="https://seat.zafatour.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
              >
                seat.zafatour.com <ExternalLink className="w-3 h-3" />
              </a>
              . Menampilkan hanya jadwal dengan sisa kursi &gt; 0.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Update: {lastUpdated}
              </span>
            )}
            <button
              id="btn-refresh-seats"
              onClick={fetchSeatData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <label htmlFor={searchInputId} className="sr-only">Cari paket atau tanggal</label>
            <input
              id={searchInputId}
              type="text"
              placeholder="Cari nama group paket atau tanggal keberangkatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 shadow-sm transition-all"
            />
          </div>
          <div className="text-xs font-semibold text-slate-500 self-start sm:self-center">
            Menampilkan <span className="text-blue-700 font-bold">{filteredSeats.length}</span> jadwal dengan kursi tersedia
          </div>
        </div>

        {/* Content */}
        {loading && seats.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">
              Menghubungkan ke sistem seat.zafatour.com...
            </p>
          </div>
        ) : errorMsg && seats.length === 0 ? (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Gagal Mengambil Data Live</div>
              <div className="text-xs mt-1 text-amber-700">{errorMsg}</div>
            </div>
          </div>
        ) : filteredSeats.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-500 text-sm">
              Tidak ada paket keberangkatan yang cocok dengan kata kunci &quot;{searchTerm}&quot;.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table id="table-seats-data" className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">No</th>
                    <th className="py-3.5 px-4">Nama Group / Paket Umroh</th>
                    <th className="py-3.5 px-4">Tanggal Keberangkatan</th>
                    <th className="py-3.5 px-4 text-center">Sisa Seat</th>
                    <th className="py-3.5 px-4 text-right">Aksi Booking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSeats.map((item, idx) => (
                    <tr
                      key={`${item.no}-${idx}`}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {item.no}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{item.group}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="inline-flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span>{item.departureDate}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                            item.sisaSeat > 20
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.sisaSeat > 5
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          {item.sisaSeat} Kursi
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          id={`btn-book-seat-${item.no}`}
                          onClick={() => handleBookingWA(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all active:scale-95"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Pesan Seat</span>
                          <ArrowUpRight className="w-3 h-3 opacity-70" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
