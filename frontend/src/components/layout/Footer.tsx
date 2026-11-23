'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/common/Logo';
import { ShieldCheck, Clock, CheckCircle2, PhoneCall, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const pathname = usePathname();

  // Yönetim paneli rotalarında genel müşteri footer'ı render edilmez
  if (pathname?.startsWith('/yonetim')) {
    return null;
  }
  return (
    <footer className="bg-[#0F172A] text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Üst Güvence Rozetleri */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-base">Şeffaf & Sürprizsiz Fiyat</h4>
              <p className="text-sm text-slate-400 mt-1">
                Gördüğünüz fiyat nihaidir. Gizli ek ücret, sürpriz sigorta kesintisi veya depozito şoku yaşamazsınız.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-base">2 Saat Hazırlık Tamponu</h4>
              <p className="text-sm text-slate-400 mt-1">
                Her kiralamadan önce araçlarımız 2 saat boyunca temizlenir, dezenfekte edilir ve teknik bakımdan geçirilir.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-base">Koşulsuz Tam İade</h4>
              <p className="text-sm text-slate-400 mt-1">
                Teslimat anına kadar onaylanmış rezervasyonunuzu tek tıkla iptal edebilir, tam tutar iadenizi anında alabilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* Ana Footer Bağlantıları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 py-12 border-b border-slate-800">
          {/* Kolon 1: Logo ve Açıklama */}
          <div className="space-y-4">
            <Logo size="lg" variant="dark" />
            <p className="text-sm text-slate-400 leading-relaxed">
              Türkiye’nin en şeffaf, modern ve güvenilir yeni nesil araç kiralama deneyimi. Plaka şubede, araç garantisi cebinizde.
            </p>
            <div className="text-xs text-slate-500">
              KVKK & AES-256 Şifrelenmiş Güvenli Altyapı
            </div>
          </div>

          {/* Kolon 2: Hızlı Bağlantılar */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Hızlı Bağlantılar</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/araclar" className="text-slate-400 hover:text-white transition-colors">
                  Müsait Araçlar & Fiyatlar
                </Link>
              </li>
              <li>
                <Link href="/#nasil-calisir" className="text-slate-400 hover:text-white transition-colors">
                  Nasıl Çalışır?
                </Link>
              </li>
              <li>
                <Link href="/#kurallar" className="text-slate-400 hover:text-white transition-colors">
                  Segment Yaş & Ehliyet Şartları
                </Link>
              </li>
              <li>
                <Link href="/#sss" className="text-slate-400 hover:text-white transition-colors">
                  Sıkça Sorulan Sorular
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolon 3: Müşteri & Güvenlik */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Müşteri & Kurallar</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/hesabim" className="text-slate-400 hover:text-white transition-colors">
                  KYC Profil Doğrulama
                </Link>
              </li>
              <li>
                <Link href="/rezervasyonlarim" className="text-slate-400 hover:text-white transition-colors">
                  Rezervasyonlarım & İptal
                </Link>
              </li>
              <li>
                <span className="text-slate-400">Aynı Şubeye İade Zorunluluğu</span>
              </li>
              <li>
                <span className="text-slate-400">15 Dakika Ödeme Blokesi Koruması</span>
              </li>
            </ul>
          </div>

          {/* Kolon 4: İletişim & Destek */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">İletişim & Destek</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2.5">
                <PhoneCall className="w-4 h-4 text-blue-400 shrink-0" />
                <span>0850 123 45 67 (7/24 Destek)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <span>destek@earackiralama.com</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Merkez: Maslak Mah. Büyükdere Cad. No:123 Sarıyer / İstanbul</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Alt Telif */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} EAraç Kiralama A.Ş. Tüm hakları saklıdır.</p>
          <div className="flex gap-6">
            <span>Kullanıcı Sözleşmesi</span>
            <span>Gizlilik Politikası & KVKK</span>
            <span>Çerez Politikası</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
