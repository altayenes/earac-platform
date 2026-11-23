'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Branch } from '@/types/api';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Car,
  ChevronDown,
  Sparkles,
  Users,
  Award,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [pickupDate, setPickupDate] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('10:00');
  const [returnDate, setReturnDate] = useState<string>('');
  const [returnTime, setReturnTime] = useState<string>('10:00');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Alış saati değiştiğinde iade saatini otomatik eşitle (Günlük kiralama kuralı)
  useEffect(() => {
    setReturnTime(pickupTime);
  }, [pickupTime]);

  // Varsayılan tarihleri ayarla (Yarın alış, 3 gün sonra iade)
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const after3Days = new Date(tomorrow);
    after3Days.setDate(after3Days.getDate() + 3);

    setPickupDate(tomorrow.toISOString().split('T')[0]);
    setReturnDate(after3Days.toISOString().split('T')[0]);

    // Şubeleri yükle
    api.branches
      .getAll()
      .then((data) => {
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
        }
      })
      .catch(() => {
        // Şubeler yüklenemezse veya backend kapalıysa varsayılan şube ekle
        setBranches([
          {
            id: '1',
            name: 'İstanbul Havalimanı (İST)',
            address: 'Tayakadın, Terminal Cad. No:1, Arnavutköy/İstanbul',
            openingTime: '00:00',
            closingTime: '23:59',
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: '2',
            name: 'İstanbul Sabiha Gökçen (SAW)',
            address: 'Sanayi, Sabiha Gökçen Havalimanı, Pendik/İstanbul',
            openingTime: '00:00',
            closingTime: '23:59',
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: '3',
            name: 'Ankara Esenboğa Havalimanı (ESB)',
            address: 'Balıkhisar, Özal Bulvarı, Çubuk/Ankara',
            openingTime: '08:00',
            closingTime: '22:00',
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
        ]);
        setSelectedBranchId('1');
      });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedBranchId) {
      setErrorMsg('Lütfen alış/iade şubesini seçiniz.');
      return;
    }
    if (!pickupDate || !returnDate) {
      setErrorMsg('Lütfen alış ve iade tarihlerini seçiniz.');
      return;
    }

    const pickupDateTime = new Date(`${pickupDate}T${pickupTime}:00`);
    const returnDateTime = new Date(`${returnDate}T${returnTime}:00`);

    if (pickupDateTime <= new Date()) {
      setErrorMsg('Alış zamanı geçmiş veya şu anki zamandan önce olamaz.');
      return;
    }

    if (returnDateTime <= pickupDateTime) {
      setErrorMsg('İade zamanı, alış zamanından sonra olmalıdır (Minimum 1 gün).');
      return;
    }

    // URL parametreleri oluşturup /araclar sayfasına yönlendir
    const params = new URLSearchParams({
      branchId: selectedBranchId,
      pickupAt: pickupDateTime.toISOString(),
      returnAt: returnDateTime.toISOString(),
    });

    router.push(`/araclar?${params.toString()}`);
  };

  const faqs = [
    {
      q: 'Rezervasyon yaparken neden araç plakası göremiyorum?',
      a: 'EAraç Kiralama’da sistemimiz model veya plaka değil; segment, kasa tipi, vites ve yakıt garantisi sunar. Fiziksel araç plakası, aracınızın 2 saatlik detaylı temizlik ve teknik kontrolleri tamamlandıktan sonra şubede teslim anında atanır.',
    },
    {
      q: 'Kiralama için yaş ve ehliyet süresi şartları nelerdir?',
      a: 'Ekonomik segment için minimum 21 yaş ve 2 yıllık ehliyet; Orta segment için minimum 23 yaş ve 3 yıllık ehliyet; Premium segment için ise minimum 25 yaş ve 5 yıllık ehliyet zorunludur.',
    },
    {
      q: 'Rezervasyonumu iptal etmek istersem ceza veya kesinti uygulanır mı?',
      a: 'Hayır! Teslimat saatine kadar rezervasyonunuzu "Rezervasyonlarım" ekranından tek tıkla iptal edebilirsiniz. Ödediğiniz tüm tutar kredi kartınıza anında %100 kesintisiz olarak iade edilir.',
    },
    {
      q: '15 dakikalık ödeme blokesi ne anlama gelir?',
      a: 'Seçtiğiniz araç grubunu rezerve ettiğiniz anda sistem, başka müşterilerin aracı kiralamasını engellemek için 15 dakika boyunca aracı sizin adınıza kilitler. Bu süre içinde güvenli ödeme işleminizi tamamlayabilirsiniz.',
    },
    {
      q: 'Farklı bir şubeye iade yapabilir miyim?',
      a: 'Sistem prensibimiz gereği, araç filosu lojistiği ve kapasite tutarlılığı için alış ve iade aynı şubeden yapılmaktadır.',
    },
  ];

  return (
    <div className="flex flex-col">
      {/* HERO BÖLÜMÜ */}
      <section className="relative bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white pt-16 pb-28 sm:pt-20 sm:pb-36 overflow-hidden">
        {/* Arka plan süslemeleri */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#2563EB_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs sm:text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>2 Saatlik Temizlik & Bakım Tamponu ile Tertemiz Araçlar</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none">
            Sürpriz Yok, Sıra Yok. <br />
            <span className="text-blue-500">Tam Güvenceli</span> Araç Kiralama.
          </h1>

          <p className="mt-4 sm:mt-6 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Şeffaf fiyatlar, segment-kasa garantisi ve koşulsuz iptal imkanıyla yola çıkmanın en güvenilir yolu.
          </p>
        </div>
      </section>

      {/* YÜKSELEN ARAMA FORMU KARTI */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 sm:-mt-24 relative z-20 w-full">
        <div className="bg-[#F8FAFC] rounded-2xl p-6 sm:p-8 shadow-xl border border-[#CBD5E1]">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              {/* Alış & İade Şubesi */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Alış & İade Şubesi</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-500">Filo kuralları gereği iade aynı şubeye yapılır.</p>
              </div>

              {/* Alış Tarihi & Saati */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Alış Tarihi & Saati</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="col-span-3 bg-white border border-[#CBD5E1] rounded-xl px-3 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="col-span-2 bg-white border border-[#CBD5E1] rounded-xl px-2 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 text-center"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500">Planlanan teslim alma anı</p>
              </div>

              {/* İade Tarihi & Saati */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>İade Tarihi & Saati</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="col-span-3 bg-white border border-[#CBD5E1] rounded-xl px-3 py-3 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                  <input
                    type="time"
                    value={returnTime}
                    readOnly
                    className="col-span-2 bg-slate-100 border border-[#CBD5E1] rounded-xl px-2 py-3 text-slate-500 text-sm font-semibold text-center cursor-not-allowed"
                    title="Günlük kiralama gereği alış saatiyle aynıdır"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Günlük kiralama gereği alış saatiyle aynıdır</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
                <span className="font-bold">Hata:</span> {errorMsg}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#CBD5E1]">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Ücretsiz İptal
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Gizli Masraf Yok
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Kredi Kartı Güvencesi
                </span>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-md hover:shadow-lg active:scale-98"
              >
                <Search className="w-5 h-5" />
                <span>Müsait Araçları Bul</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* SEGMENT ŞARTLARI & KURALLAR */}
      <section id="kurallar" className="py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
            Şeffaf Segment ve Sürücü Koşulları
          </h2>
          <p className="mt-3 text-slate-600 text-base">
            Güvenliğiniz için yaş ve ehliyet kurallarımız sabittir, kiralama öncesinde KYC doğrulamasından geçirilir.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ekonomik */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 hover:border-blue-400 transition-all shadow-xs hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                  Şehir İçi & Ekonomik
                </span>
                <Car className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A]">Ekonomik Segment</h3>
              <p className="text-sm text-slate-600 mt-2">
                Düşük yakıt tüketimi, kolay park ve bütçe dostu konfor arayanlar için ideal.
              </p>

              <div className="mt-6 space-y-3 border-t border-[#CBD5E1] pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Asgari Sürücü Yaşı:</span>
                  <span className="font-bold text-slate-900">21 Yaş</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Asgari Ehliyet Süresi:</span>
                  <span className="font-bold text-slate-900">2 Yıl</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Yakıt & Vites:</span>
                  <span className="font-semibold text-slate-900">Benzin / Otomatik / Manuel</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#CBD5E1] text-xs text-slate-500">
              Renault Clio, Hyundai i20, Fiat Egea ve muadilleri.
            </div>
          </div>

          {/* Orta */}
          <div className="bg-[#F8FAFC] border-2 border-blue-600 rounded-2xl p-6 sm:p-8 relative shadow-md flex flex-col justify-between">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-extrabold uppercase px-3 py-1 rounded-full shadow-xs">
              En Çok Tercih Edilen
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                  Aile & Konfor
                </span>
                <Award className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A]">Orta Segment</h3>
              <p className="text-sm text-slate-600 mt-2">
                Geniş bagaj hacmi, yüksek sürüş konforu ve uzun yol rahatlığı.
              </p>

              <div className="mt-6 space-y-3 border-t border-[#CBD5E1] pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Asgari Sürücü Yaşı:</span>
                  <span className="font-bold text-slate-900">23 Yaş</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Asgari Ehliyet Süresi:</span>
                  <span className="font-bold text-slate-900">3 Yıl</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Yakıt & Vites:</span>
                  <span className="font-semibold text-slate-900">Dizel / Hibrit / Otomatik</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#CBD5E1] text-xs text-slate-500">
              Toyota Corolla, VW Golf, Ford Focus, Peugeot 2008 ve muadilleri.
            </div>
          </div>

          {/* Premium */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 hover:border-blue-400 transition-all shadow-xs hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-slate-200 text-slate-800 text-xs font-bold rounded-full border border-slate-300">
                  Prestij & Lüks
                </span>
                <ShieldCheck className="w-6 h-6 text-[#0F172A]" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A]">Premium Segment</h3>
              <p className="text-sm text-slate-600 mt-2">
                Üst düzey güvenlik donanımı, dinamik performans ve maksimum prestij.
              </p>

              <div className="mt-6 space-y-3 border-t border-[#CBD5E1] pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Asgari Sürücü Yaşı:</span>
                  <span className="font-bold text-slate-900">25 Yaş</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Asgari Ehliyet Süresi:</span>
                  <span className="font-bold text-slate-900">5 Yıl</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Yakıt & Vites:</span>
                  <span className="font-semibold text-slate-900">Benzin / Hibrit / Otomatik</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#CBD5E1] text-xs text-slate-500">
              BMW 3/5 Serisi, Mercedes-Benz C/E Serisi, Audi A4/A6 ve muadilleri.
            </div>
          </div>
        </div>
      </section>

      {/* NASIL ÇALIŞIR? */}
      <section id="nasil-calisir" className="py-20 bg-[#DCE4EE]/60 border-y border-[#CBD5E1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Nasıl Çalışır? 3 Kolay Adımda Yoldasınız
            </h2>
            <p className="mt-3 text-slate-600 text-base">
              Dakikalar süren evrak işlerine son veriyoruz. Tamamen dijital, hızlı ve şeffaf süreç.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#CBD5E1] text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                1
              </div>
              <h3 className="font-bold text-lg text-[#0F172A]">Tarih ve Segment Seçimi</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                İhtiyacınıza uygun tarih aralığını ve araç segmentini filtreleyin. Kesin fiyatı net olarak görün.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#CBD5E1] text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                2
              </div>
              <h3 className="font-bold text-lg text-[#0F172A]">15 Dk Bloke ile Güvenli Ödeme</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Aracınız sizin için rezerve edilir ve 15 dakika boyunca korunur. Kartınızla güvenle ödemeyi tamamlayın.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#CBD5E1] text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                3
              </div>
              <h3 className="font-bold text-lg text-[#0F172A]">Hazırlanmış Aracını Şubeden Al</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                2 saatlik hijyen ve mekanik kontrollerden geçmiş aracınız şubede hazır. Kimliğinizi gösterin ve yola çıkın!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SIKÇA SORULAN SORULAR */}
      <section id="sss" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-xs tracking-wider uppercase mb-2">
            <HelpCircle className="w-4 h-4" />
            <span>Merak Edilenler</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
            Sıkça Sorulan Sorular
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl overflow-hidden transition-all shadow-2xs"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-5 text-left font-bold text-slate-800 hover:text-blue-600 focus:outline-none"
              >
                <span className="text-base sm:text-lg">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0 ml-3 ${
                    openFaq === idx ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
