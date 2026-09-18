interface HeroBannerProps {
  onExplorePackages: () => void;
  onCheckSeats: () => void;
}

export default function HeroBanner({
  onExplorePackages,
  onCheckSeats,
}: HeroBannerProps) {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-blue-800 to-sky-900 text-white py-3 sm:py-4 border-b border-blue-800/40"
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          <button
            id="btn-hero-packages"
            onClick={onExplorePackages}
            className="px-4 py-1.5 sm:px-5 sm:py-2 bg-white hover:bg-slate-100 text-blue-900 text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all transform active:scale-95"
          >
            Lihat Paket Umroh & Haji
          </button>
          <button
            id="btn-hero-seats"
            onClick={onCheckSeats}
            className="px-4 py-1.5 sm:px-5 sm:py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow-sky-500/20 transition-all transform active:scale-95"
          >
            <span className="hidden sm:inline">Cek Sisa Kursi Tersedia</span>
            
          </button>
        </div>
      </div>
    </section>
  );
}
