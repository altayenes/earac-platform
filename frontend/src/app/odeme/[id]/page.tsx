'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Reservation } from '@/types/api';
import { useAuth } from '@/context/AuthContext';
import {
  formatCurrency,
  formatDateTime,
  getReservationStatusLabel,
  getStatusBadgeClass,
  getSegmentLabel,
  getBodyTypeLabel,
} from '@/lib/statusLabels';
import {
  CreditCard,
  Lock,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function OdemePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const resolvedParams = use(params);
  const reservationId = resolvedParams.id;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Kredi Kartı Form Alanları (Simülasyon)
  const [cardHolder, setCardHolder] = useState('Ahmet Yılmaz');
  const [cardNumber, setCardNumber] = useState('4543600000000001');
  const [expireMonth, setExpireMonth] = useState('12');
  const [expireYear, setExpireYear] = useState('28');
  const [cvv, setCvv] = useState('123');

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // 15 Dakika Geri Sayım Sayacı
  const [remainingSeconds, setRemainingSeconds] = useState<number>(900);

  // BULGU-FE-02: Oturum Açmamış Kullanıcıyı Giriş Sayfasına Yönlendir
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/giris?redirect=/odeme/${reservationId}`);
    }
  }, [authLoading, user, reservationId, router]);

  // Rezervasyonu Yükle
  useEffect(() => {
    if (!reservationId || authLoading || !user) return;

    api.reservations
      .getById(reservationId)
      .then((data) => {
        setReservation(data);

        // Kalan süreyi hesapla
        if (data.expiresAt) {
          const diff = Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
          setRemainingSeconds(diff > 0 ? diff : 0);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Rezervasyon bulunamadı.';
        setErrorMsg(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [reservationId, authLoading, user]);

  // Canlı Geri Sayım Timer
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 120; // Son 2 dakika

  // Ödeme İşlemi
  const handlePayment = async (simulateFailure: boolean = false) => {
    if (!reservation) return;
    setIsProcessing(true);
    setPaymentError('');

    // Güvenli tekil idempotency anahtarı üret
    const idempotencyKey = `idem_${reservation.id}_${Date.now()}`;

    try {
      await api.payments.charge({
        reservationId: reservation.id,
        idempotencyKey,
        cardHolderName: cardHolder,
        cardNumber,
        expireMonth,
        expireYear,
        cvv,
        simulateFailure,
      });

      if (simulateFailure) {
        setPaymentError('Ödeme simülasyonu: Banka kart limit yetersizliği nedeniyle reddetti (PAYMENT_FAILED).');
      } else {
        setPaymentSuccess(true);
        setTimeout(() => {
          router.push('/rezervasyonlarim');
        }, 3000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ödeme tamamlanamadı.';
      setPaymentError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading || (!user && !errorMsg)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Oturum bilgileri doğrulanıyor...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Rezervasyon bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (errorMsg || !reservation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-8 shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Rezervasyon Bulunamadı</h2>
          <p className="text-slate-600 text-sm mt-2">{errorMsg || 'Geçersiz rezervasyon bağlantısı.'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const snapshot = reservation.priceSnapshot;
  const isExpired = remainingSeconds <= 0 && reservation.state === 'PENDING_PAYMENT';
  const isAlreadyConfirmed = reservation.state === 'CONFIRMED';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* 15 Dakika Geri Sayım Şeridi */}
      {!isAlreadyConfirmed && !isExpired && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
            isUrgent
              ? 'bg-rose-50 border-rose-300 text-rose-900 animate-pulse'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock className={`w-6 h-6 ${isUrgent ? 'text-rose-600' : 'text-amber-600'}`} />
            <div>
              <span className="font-bold text-sm">Kapasite Ödeme Blokesi Aktif</span>
              <p className="text-xs opacity-90">
                Seçtiğiniz araç grubu adınıza ayrılmıştır. Süre dolduğunda kapasite serbest kalır.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider">Kalan Süre:</span>
            <div
              className={`px-4 py-1.5 rounded-xl text-lg font-black tracking-widest ${
                isUrgent ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {formatTimer(remainingSeconds)}
            </div>
          </div>
        </div>
      )}

      {/* Süresi Dolmuş Uyarısı */}
      {isExpired && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold text-sm">Ödeme Süresi Doldu</span>
            <p className="text-xs mt-0.5">
              15 dakikalık ödeme blokesi tamamlandığı için kapasite diğer müşteriler için serbest bırakılmıştır. Lütfen
              yeniden arama yapınız.
            </p>
          </div>
        </div>
      )}

      {/* Zaten Onaylanmış Uyarısı */}
      {isAlreadyConfirmed && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-sm">Bu Rezervasyon Onaylanmıştır</span>
            <p className="text-xs mt-0.5">Ödeme başarıyla tamamlanmış ve araç teslimata ayrılmıştır.</p>
          </div>
        </div>
      )}

      {paymentSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-xl font-black text-emerald-900">Ödemeniz Başarıyla Alındı!</h3>
          <p className="text-sm text-emerald-700">
            Rezervasyonunuz <strong>ONAYLANDI</strong>. Rezervasyonlarım sayfasına yönlendiriliyorsunuz...
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* SOL: ÖDEME FORMU (3 Kolon) */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#CBD5E1]">
              <div className="flex items-center gap-2 font-black text-slate-900 text-lg">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span>Kart ile Güvenli Ödeme</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sandbox Test Modu</span>
              </div>
            </div>

            {paymentError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Kart Üzerindeki İsim</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  disabled={isProcessing || isExpired || isAlreadyConfirmed}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Kart Numarası</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 tracking-wider focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  disabled={isProcessing || isExpired || isAlreadyConfirmed}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Ay (MM)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={expireMonth}
                    onChange={(e) => setExpireMonth(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-center focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    disabled={isProcessing || isExpired || isAlreadyConfirmed}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Yıl (YY)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={expireYear}
                    onChange={(e) => setExpireYear(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-center focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    disabled={isProcessing || isExpired || isAlreadyConfirmed}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">CVV</label>
                  <input
                    type="password"
                    maxLength={3}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-center focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    disabled={isProcessing || isExpired || isAlreadyConfirmed}
                  />
                </div>
              </div>
            </div>

            {/* Aksiyon Butonları */}
            <div className="pt-4 border-t border-[#CBD5E1] space-y-3">
              <button
                type="button"
                onClick={() => handlePayment(false)}
                disabled={isProcessing || isExpired || isAlreadyConfirmed}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-xl shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Güvenli Ödeme Yap ({formatCurrency(snapshot?.totalAmount || 0)})</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handlePayment(true)}
                disabled={isProcessing || isExpired || isAlreadyConfirmed}
                className="w-full py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Sandbox Test: Başarısız Ödeme Simülasyonu Yap (PAYMENT_FAILED)
              </button>
            </div>

            <div className="text-[11px] text-slate-500 leading-relaxed text-center">
              Ödeme tutarı doğrudan backend veri tabanındaki dondurulmuş fiyat snapshot&apos;ından çekilir; istemciden
              asla tutar gönderilmez. Idempotency korumalıdır.
            </div>
          </div>
        </div>

        {/* SAĞ: DONDURULMUŞ FİYAT SNAPSHOT'I VE ÖZETİ (2 Kolon) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 shadow-xs space-y-5">
            <h3 className="font-bold text-slate-900 text-base pb-3 border-b border-[#CBD5E1]">
              Fiyat Snapshot Dökümü
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Şube:</span>
                <span className="font-bold text-slate-900">{reservation.branchName}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Alış:</span>
                <span className="font-semibold text-slate-900">{formatDateTime(reservation.startTime)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>İade:</span>
                <span className="font-semibold text-slate-900">{formatDateTime(reservation.endTime)}</span>
              </div>

              {snapshot && (
                <>
                  <div className="h-px bg-slate-200 my-2" />
                  <div className="flex justify-between text-slate-600">
                    <span>Segment & Kasa:</span>
                    <span className="font-semibold text-slate-900">
                      {getSegmentLabel(snapshot.segmentName || '')} {getBodyTypeLabel(snapshot.bodyTypeName || '')}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Günlük Birim Fiyat:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(snapshot.dailyPrice)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Kiralama Süresi:</span>
                    <span className="font-semibold text-slate-900">{snapshot.totalDays} Gün</span>
                  </div>

                  <div className="h-px bg-slate-200 my-2" />

                  <div className="flex justify-between items-baseline pt-2">
                    <span className="font-bold text-slate-900 text-base">Toplam Tutar:</span>
                    <span className="font-black text-2xl text-blue-600">
                      {formatCurrency(snapshot.totalAmount)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-[#CBD5E1] text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>KDV ve Zorunlu Trafik Sigortası Dahildir</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Teslimat anına kadar %100 Ücretsiz İptal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
