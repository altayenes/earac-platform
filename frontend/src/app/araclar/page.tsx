'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AvailableGroup, Branch } from '@/types/api';
import {
  formatCurrency,
  formatDateTime,
  getSegmentLabel,
  getBodyTypeLabel,
  getFuelTypeLabel,
  getTransmissionLabel,
} from '@/lib/statusLabels';
import {
  Car,
  Filter,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  X,
  SlidersHorizontal,
} from 'lucide-react';

function AraclarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const branchId = searchParams.get('branchId') || '';
  const pickupAt = searchParams.get('pickupAt') || '';
  const returnAt = searchParams.get('returnAt') || '';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [allBranchGroups, setAllBranchGroups] = useState<AvailableGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [reservingGroupKey, setReservingGroupKey] = useState<string | null>(null);

  // Filtre durumları
  const [selectedSegment, setSelectedSegment] = useState<string>('ALL');
  const [selectedFuel, setSelectedFuel] = useState<string>('ALL');
  const [selectedTransmission, setSelectedTransmission] = useState<string>('ALL');
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Şubeleri yükle
  useEffect(() => {
    api.branches.getAll().then(setBranches).catch(() => {});
  }, []);

  const currentBranch = branches.find((b) => b.id === branchId);

  // Müsaitlik aramasını yap
  useEffect(() => {
    if (!branchId || !pickupAt || !returnAt) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    api.reservations
      .searchAvailability({
        branchId,
        plannedPickupAt: pickupAt,
        plannedReturnAt: returnAt,
      })
      .then((data) => {
        setAvailableGroups(data);
        setAllBranchGroups(data);
      })
      .catch((err: any) => {
        setErrorMsg(err.message || 'Müsaitlik bilgisi alınamadı.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [branchId, pickupAt, returnAt]);

  // Filtrelenmiş araç grupları
  const filteredGroups = useMemo(() => {
    return availableGroups.filter((group) => {
      if (selectedSegment !== 'ALL' && group.segmentName !== selectedSegment && group.segmentId !== selectedSegment) {
        return false;
      }
      if (selectedFuel !== 'ALL' && group.fuelTypeName !== selectedFuel && group.fuelTypeId !== selectedFuel) {
        return false;
      }
      if (
        selectedTransmission !== 'ALL' &&
        group.transmissionTypeName !== selectedTransmission &&
        group.transmissionTypeId !== selectedTransmission
      ) {
        return false;
      }
      return true;
    });
  }, [availableGroups, selectedSegment, selectedFuel, selectedTransmission]);

  // Filtre sıfırlandığında gösterilecek alternatifler
  const hasFilterActive = selectedSegment !== 'ALL' || selectedFuel !== 'ALL' || selectedTransmission !== 'ALL';

  const handleReserve = async (group: AvailableGroup) => {
    const groupKey = `${group.segmentId}-${group.bodyTypeId}-${group.fuelTypeId}-${group.transmissionTypeId}`;
    setReservingGroupKey(groupKey);

    const redirectUrl = `/araclar?branchId=${encodeURIComponent(branchId)}&pickupAt=${encodeURIComponent(pickupAt)}&returnAt=${encodeURIComponent(returnAt)}`;

    // 1. Giriş kontrolü
    if (!isAuthenticated || !user) {
      router.push(`/giris?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    // 2. KYC Profil Kontrolü
    if (!user.customerProfile) {
      alert('Rezervasyon yapabilmek için lütfen önce profil bilgilerinizi (Ad, Soyad, TC No, Ehliyet Tarihi) tamamlayınız.');
      router.push(`/hesabim?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    // 3. Yaş ve Ehliyet Kural Denetimi
    const userAge = user.customerProfile.calculatedAge;
    const userLicense = user.customerProfile.calculatedLicenseYears;

    if (userAge < group.minAge || userLicense < group.minLicenseYears) {
      alert(
        `Uygunluk Uyarısı: Seçtiğiniz ${getSegmentLabel(group.segmentName)} segmenti için asgari ${group.minAge} yaş ve ${group.minLicenseYears} yıllık ehliyet gereklidir. Profiliniz: ${userAge} yaş, ${userLicense} yıl ehliyet.`
      );
      setReservingGroupKey(null);
      return;
    }

    // 4. Rezervasyon Oluştur
    try {
      const reservation = await api.reservations.create({
        branchId,
        segmentId: group.segmentId,
        bodyTypeId: group.bodyTypeId,
        fuelTypeId: group.fuelTypeId,
        transmissionId: group.transmissionTypeId,
        plannedPickupAt: pickupAt,
        plannedReturnAt: returnAt,
      });

      // Ödeme sayfasına yönlendir
      router.push(`/odeme/${reservation.id}`);
    } catch (err: any) {
      alert(`Rezervasyon oluşturulamadı: ${err.message || 'Lütfen tekrar deneyiniz.'}`);
      setReservingGroupKey(null);
    }
  };

  if (!branchId || !pickupAt || !returnAt) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-8 shadow-xs">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Arama Kriteri Bulunamadı</h2>
          <p className="text-slate-600 text-sm mt-2">
            Müsait araçları görebilmek için lütfen ana sayfadan şube ve tarih seçimi yapınız.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ÜST BİLGİ ŞERİDİ (Arama Özeti) */}
      <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-5 mb-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-xs text-slate-500 block">Alış ve İade Şubesi</span>
              <span className="font-bold text-slate-900">{currentBranch?.name || 'Seçili Şube'}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-300 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-xs text-slate-500 block">Alış Tarihi</span>
              <span className="font-semibold text-slate-900">{formatDateTime(pickupAt)}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-300 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-xs text-slate-500 block">İade Tarihi</span>
              <span className="font-semibold text-slate-900">{formatDateTime(returnAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Tarihleri Değiştir
          </button>

          <button
            onClick={() => setMobileFilterOpen(true)}
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 bg-slate-200 text-slate-800 rounded-lg text-xs font-bold"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtrele</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* SOL FİLTRE PANELİ (Masaüstü) */}
        <aside className="hidden md:block md:col-span-1 space-y-6">
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-5 shadow-xs sticky top-24">
            <div className="flex items-center justify-between pb-4 border-b border-[#CBD5E1]">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Filtreler</span>
              </div>
              {hasFilterActive && (
                <button
                  onClick={() => {
                    setSelectedSegment('ALL');
                    setSelectedFuel('ALL');
                    setSelectedTransmission('ALL');
                  }}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Temizle
                </button>
              )}
            </div>

            {/* Segment Filtresi */}
            <div className="py-4 border-b border-[#CBD5E1]">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
                Segment
              </label>
              <div className="space-y-1.5">
                {['ALL', 'Ekonomik', 'Orta', 'Premium'].map((seg) => (
                  <label
                    key={seg}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/50 cursor-pointer text-sm font-medium text-slate-700"
                  >
                    <span>{seg === 'ALL' ? 'Tümü' : seg}</span>
                    <input
                      type="radio"
                      name="segment"
                      checked={selectedSegment === seg}
                      onChange={() => setSelectedSegment(seg)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Yakıt Filtresi */}
            <div className="py-4 border-b border-[#CBD5E1]">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
                Yakıt Tipi
              </label>
              <div className="space-y-1.5">
                {['ALL', 'Benzin', 'Dizel', 'Hibrit', 'Elektrikli'].map((fuel) => (
                  <label
                    key={fuel}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/50 cursor-pointer text-sm font-medium text-slate-700"
                  >
                    <span>{fuel === 'ALL' ? 'Tümü' : fuel}</span>
                    <input
                      type="radio"
                      name="fuel"
                      checked={selectedFuel === fuel}
                      onChange={() => setSelectedFuel(fuel)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Vites Filtresi */}
            <div className="pt-4">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
                Vites Tipi
              </label>
              <div className="space-y-1.5">
                {['ALL', 'Otomatik', 'Manuel'].map((trans) => (
                  <label
                    key={trans}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/50 cursor-pointer text-sm font-medium text-slate-700"
                  >
                    <span>{trans === 'ALL' ? 'Tümü' : trans}</span>
                    <input
                      type="radio"
                      name="trans"
                      checked={selectedTransmission === trans}
                      onChange={() => setSelectedTransmission(trans)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* MOBİL DRAWER FİLTRE */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
            <div className="w-4/5 max-w-sm bg-[#F8FAFC] h-full p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#CBD5E1]">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Filter className="w-5 h-5 text-blue-600" />
                  <span>Filtreler</span>
                </div>
                <button onClick={() => setMobileFilterOpen(false)} className="p-1 rounded-lg hover:bg-slate-200">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Segment */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Segment</label>
                <div className="space-y-2">
                  {['ALL', 'Ekonomik', 'Orta', 'Premium'].map((seg) => (
                    <label key={seg} className="flex items-center justify-between text-sm text-slate-800">
                      <span>{seg === 'ALL' ? 'Tümü' : seg}</span>
                      <input
                        type="radio"
                        name="mob_seg"
                        checked={selectedSegment === seg}
                        onChange={() => setSelectedSegment(seg)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Yakıt */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Yakıt</label>
                <div className="space-y-2">
                  {['ALL', 'Benzin', 'Dizel', 'Hibrit'].map((fuel) => (
                    <label key={fuel} className="flex items-center justify-between text-sm text-slate-800">
                      <span>{fuel === 'ALL' ? 'Tümü' : fuel}</span>
                      <input
                        type="radio"
                        name="mob_fuel"
                        checked={selectedFuel === fuel}
                        onChange={() => setSelectedFuel(fuel)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Vites */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase block mb-2">Vites</label>
                <div className="space-y-2">
                  {['ALL', 'Otomatik', 'Manuel'].map((trans) => (
                    <label key={trans} className="flex items-center justify-between text-sm text-slate-800">
                      <span>{trans === 'ALL' ? 'Tümü' : trans}</span>
                      <input
                        type="radio"
                        name="mob_trans"
                        checked={selectedTransmission === trans}
                        onChange={() => setSelectedTransmission(trans)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl"
              >
                Sonuçları Gör
              </button>
            </div>
          </div>
        )}

        {/* SAĞ LİSTE PANELİ */}
        <main className="md:col-span-3 space-y-6">
          {/* Bilgilendirme Banner'ı: Plaka kuralı */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-blue-900 leading-relaxed">
              <span className="font-bold">EAraç Kiralama Garantisi:</span> Seçtiğiniz segment, kasa tipi, vites ve yakıt
              özellikleri %100 taahhüt edilir. <strong>Plaka ve VIN numarası</strong> güvenlik ve 2 saatlik hazırlık
              tamponu gereği şubede anahtar tesliminde netleşir.
            </div>
          </div>

          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-600 text-sm font-medium">Müsait araç grupları hesaplanıyor...</p>
            </div>
          ) : errorMsg ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-700">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <p className="font-bold">{errorMsg}</p>
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-600">
                Toplam <span className="text-slate-900 font-bold">{filteredGroups.length}</span> araç grubu müsait
              </div>

              {filteredGroups.map((group) => {
                const groupKey = `${group.segmentId}-${group.bodyTypeId}-${group.fuelTypeId}-${group.transmissionTypeId}`;
                const isSubmitting = reservingGroupKey === groupKey;

                return (
                  <div
                    key={groupKey}
                    className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-5 sm:p-6 hover:border-blue-400 transition-all shadow-xs hover:shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Sol Bilgiler */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg">
                          {getSegmentLabel(group.segmentName)}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">
                          {getBodyTypeLabel(group.bodyTypeName)}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">
                          {getFuelTypeLabel(group.fuelTypeName)}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">
                          {getTransmissionLabel(group.transmissionTypeName)}
                        </span>
                      </div>

                      <h3 className="text-xl font-extrabold text-slate-900">
                        {getSegmentLabel(group.segmentName)} {getBodyTypeLabel(group.bodyTypeName)} Grubu
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <ShieldCheck className="w-4 h-4 text-slate-500" />
                          <span>
                            Min. {group.minAge} Yaş / {group.minLicenseYears} Yıl Ehliyet
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle className="w-4 h-4" />
                          <span>Ücretsiz İptal</span>
                        </div>
                        <div className="text-slate-500">
                          Müsait: <strong className="text-slate-800">{group.availableCount} Araç</strong>
                        </div>
                      </div>
                    </div>

                    {/* Sağ Fiyat & Rezerve Et Aksiyonu */}
                    <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 pt-4 lg:pt-0 border-[#CBD5E1] gap-4">
                      <div className="text-left lg:text-right">
                        <span className="text-xs text-slate-500 block">Günlük Birim Fiyat</span>
                        <span className="text-lg font-bold text-slate-900">
                          {formatCurrency(group.dailyPrice)}
                        </span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {group.totalDays} gün toplam:{' '}
                          <span className="font-extrabold text-blue-600 text-base">
                            {formatCurrency(group.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleReserve(group)}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-sm active:scale-98 transition-all disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Hemen Rezerve Et</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* BOŞ DURUM ÇIKMAZI YOK: Alternatifler */
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-900">
                <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
                <h3 className="font-bold text-lg">Seçtiğiniz Kriterlerde Müsait Araç Bulunamadı</h3>
                <p className="text-sm text-amber-800 mt-1">
                  Seçtiğiniz segment ve filtre kombinasyonu bu tarihlerde tamamen doludur.
                </p>
                {hasFilterActive && (
                  <button
                    onClick={() => {
                      setSelectedSegment('ALL');
                      setSelectedFuel('ALL');
                      setSelectedTransmission('ALL');
                    }}
                    className="mt-4 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700"
                  >
                    Filtreleri Temizle ve Tümünü Gör
                  </button>
                )}
              </div>

              {allBranchGroups.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <span>Aynı Şubede Alternatif Olarak Müsait Olan Gruplar:</span>
                  </h4>

                  <div className="space-y-4">
                    {allBranchGroups.slice(0, 3).map((group) => {
                      const groupKey = `alt-${group.segmentId}-${group.bodyTypeId}-${group.fuelTypeId}-${group.transmissionTypeId}`;
                      return (
                        <div
                          key={groupKey}
                          className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                        >
                          <div>
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded">
                              {getSegmentLabel(group.segmentName)}
                            </span>
                            <h4 className="font-bold text-slate-900 mt-1">
                              {getSegmentLabel(group.segmentName)} {getBodyTypeLabel(group.bodyTypeName)}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {getFuelTypeLabel(group.fuelTypeName)} • {getTransmissionLabel(group.transmissionTypeName)}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-right">
                              <span className="text-xs text-slate-500 block">{group.totalDays} Gün Toplam</span>
                              <span className="font-bold text-slate-900">{formatCurrency(group.totalAmount)}</span>
                            </div>
                            <button
                              onClick={() => handleReserve(group)}
                              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                            >
                              Bunu Seç
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AraclarPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto p-12 text-center text-slate-500">Yükleniyor...</div>}>
      <AraclarContent />
    </Suspense>
  );
}
