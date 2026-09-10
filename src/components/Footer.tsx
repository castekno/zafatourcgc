import { MapPin, Phone, Mail, ShieldCheck } from 'lucide-react';
import { WHATSAPP_LINK, WHATSAPP_NUMBER } from '../data/constants';

interface FooterProps {
  logoUrl: string;
}

export default function Footer({ logoUrl }: FooterProps) {
  return (
    <footer id="contact" className="bg-slate-900 text-white pt-4 pb-4 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Bottom Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} ZafaTour - Perwakilan Citragrand
            City (CGC) Palembang. Hak Cipta Dilindungi.
          </div>
          <div className="text-slate-400 font-semibold">
            Palembang • Makkah • Madinah
          </div>
        </div>
      </div>
    </footer>
  );
}
