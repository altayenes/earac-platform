'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Reservation } from '@/types/api';
import {
  formatCurrency,
  formatDateTime,
  getReservationStatusLabel,
  getStatusBadgeClass,
  getSegmentLabel,
  getBodyTypeLabel,
  getFuelTypeLabel,
  getTransmissionLabel,
} from '@/lib/statusLabels';
import {
  CalendarCheck,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  FileEdit,
  Ban,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function RezervasyonlarimPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // İptal Modalı
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  // Değişiklik Modalı
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [newPickupDate, setNewPickupDate] = useState('');
  const [newPickupTime, setNewPickupTime] = useState('10:00');
  const [newReturnDate, setNewReturnDate] = useState('');
  const [newReturnTime, setNewReturnTime] = useState('10:00');
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');

  const loadReservations = () => {
    setIsLoading(true);
    api.reservations
      .getMy()
      .then((data) => {
        setReservations(data);
      })
      .catch((err: any) => {
        setErrorMsg(err.message || 'Rezervasyonlarınız yüklenemedi.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/giris?redirect=/rezervasyonlarim');
      } else {
        loadReservations();
      }
    }
  }, [authLoading, isAuthenticated, router]);

  // Rezervasyon İptal Et
  const handleCancelReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation) return;
    setCancelError('');
    setCancelSuccess('');

    if (!cancelReason) {
      setCancelError('Lütfen iptal gerekçesini belirtiniz.');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      await api.reservations.cancel(selectedReservation.id, cancelReason);
      setCancelSuccess('Rezervasyonunuz iptal edildi ve ödenen bedelin tam iadesi başlatıldı!');
      setTimeout(() => {
        setCancelModalOpen(false);
        loadReservations();
      }, 2000);
    } catch (err: any) {
      setCancelError(err.message || 'İptal işlemi gerçekleştirilemedi.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Değişiklik Talebi Gönder
  const handleChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation) return;
    setChangeError('');
    setChangeSuccess('');

    const requestedPickupAt = newPickupDate ? `${newPickupDate}T${newPickupTime}:00.000Z` : undefined;
    const requestedReturnAt = newReturnDate ? `${newReturnDate}T${newReturnTime}:00.000Z` : undefined;

    setIsSubmittingChange(true);
    try {
      await api.reservations.createChangeRequest(selectedReservation.id, {
        requestedPickupAt,
        requestedReturnAt,
      });
      setChangeSuccess('Tarih değişiklik talebiniz şube yöneticisine iletildi.');
      setTimeout(() => {
        setChangeModalOpen(false);
        loadReservations();
      }, 2000);
    } catch (err: any) {
      setChangeError(err.message || 'Talep oluşturulamadı.');
    } finally {
      setIsSubmittingChange(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Rezervasyonlarınız yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] flex items-center gap-3">
            <CalendarCheck className="w-8 h-8 text-blue-600" />
            <span>Rezervasyonlarım</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Geçmiş ve aktif araç kiralama rezervasyonlarınızı buradan yönetebilirsiniz.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs"
        >
          <span>Yeni Araç Kirala</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {reservations.length === 0 ? (
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <CalendarCheck className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">Henüz bir rezervasyonunuz bulunmuyor</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Hemen araç filomuzu inceleyin, ihtiyacınıza en uygun aracı 15 dakikalık ödeme blokesi ve koşulsuz iptal
            güvencesiyle kiralayın.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700"
          >
            Müsait Araçları Ara
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {reservations.map((res) => {
            const badge = getStatusBadgeClass(res.state);
            const snapshot = res.priceSnapshot;
            const isConfirmed = res.state === 'CONFIRMED';
            const isPendingPayment = res.state === 'PENDING_PAYMENT';

            return (
              <div
                key={res.id}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl p-6 shadow-xs hover:border-slate-400 transition-all space-y-5"
              >
                {/* Üst Başlık & Durum Rozeti */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#CBD5E1]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      ID: #{res.id.slice(0, 8)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                      <span>{getReservationStatusLabel(res.state)}</span>
                    </span>
                  </div>

                  <span className="text-xs text-slate-500">
                    Oluşturulma: {formatDateTime(res.createdAt)}
                  </span>
                </div>

                {/* Rezervasyon Bilgileri */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Şube ve Tarihler */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-500 block">Şube (Alış & İade)</span>
                        <span className="font-bold text-slate-900">{res.branchName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-500 block">Alış Zamanı</span>
                        <span className="font-semibold text-slate-900">{formatDateTime(res.startTime)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-500 block">İade Zamanı</span>
                        <span className="font-semibold text-slate-900">{formatDateTime(res.endTime)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Araç Grubu ve Fiyat Snapshot'ı */}
                  <div className="space-y-3">
                    {snapshot ? (
                      <>
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500 block">Seçilen Araç Grubu</span>
                          <span className="font-bold text-slate-900 text-sm">
                            {getSegmentLabel(snapshot.segmentName || '')} {getBodyTypeLabel(snapshot.bodyTypeName || '')}
                          </span>
                          <p className="text-xs text-slate-500">
                            {getFuelTypeLabel(snapshot.fuelTypeName || '')} • {getTransmissionLabel(snapshot.transmissionTypeName || '')}
                          </p>
                        </div>

                        <div>
                          <span className="text-xs text-slate-500 block">Kiralama Bedeli ({snapshot.totalDays} Gün)</span>
                          <span className="text-xl font-black text-slate-900">
                            {formatCurrency(snapshot.totalAmount)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">Fiyat dökümü mevcut değil.</span>
                    )}
                  </div>

                  {/* Duruma Göre Aksiyonlar */}
                  <div className="flex flex-col justify-end space-y-2.5">
                    {isPendingPayment && (
                      <Link
                        href={`/odeme/${res.id}`}
                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs text-center flex items-center justify-center gap-2 shadow-xs"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Ödemeyi Tamamla (15 Dk Bloke)</span>
                      </Link>
                    )}

                    {isConfirmed && (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setSelectedReservation(res);
                            setChangeModalOpen(true);
                          }}
                          className="w-full py-2 px-3 bg-white border border-[#CBD5E1] hover:border-blue-400 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <FileEdit className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tarih / Grup Değişikliği Talep Et</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedReservation(res);
                            setCancelModalOpen(true);
                          }}
                          className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>İptal Et ve Tam İade Al</span>
                        </button>
                      </div>
                    )}

                    {res.state === 'ACTIVE' && (
                      <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-xs font-semibold text-center">
                        Aracınız kirada. Keyifli sürüşler!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* İPTAL MODALI */}
      {cancelModalOpen && selectedReservation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                <span>Rezervasyon İptali ve Tam İade</span>
              </h3>
              <button onClick={() => setCancelModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {cancelError && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl">{cancelError}</div>}
            {cancelSuccess && <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl">{cancelSuccess}</div>}

            <div className="p-3 bg-emerald-50 text-emerald-900 text-xs rounded-xl leading-relaxed">
              <strong>EAraç Kiralama Güvencesi:</strong> İptal durumunda herhangi bir ceza veya kesinti uygulanmaz.
              Ödediğiniz tutar ({formatCurrency(selectedReservation.priceSnapshot?.totalAmount || 0)}) kartınıza anında %100 iade edilir.
            </div>

            <form onSubmit={handleCancelReservation} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">İptal Gerekçeniz</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Seyahat planım ertelendi..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {isSubmittingCancel ? 'İptal Ediliyor...' : 'İptali Onayla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TARİH DEĞİŞİKLİK TALEBİ MODALI */}
      {changeModalOpen && selectedReservation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-blue-600" />
                <span>Tarih Değişiklik Talebi</span>
              </h3>
              <button onClick={() => setChangeModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {changeError && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl">{changeError}</div>}
            {changeSuccess && <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl">{changeSuccess}</div>}

            <p className="text-xs text-slate-600">
              Yeni talep ettiğiniz alış ve iade tarihlerini seçiniz. Yönetici onaylayana kadar mevcut rezervasyonunuz geçerliliğini korur.
            </p>

            <form onSubmit={handleChangeRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Yeni Alış Tarihi & Saati</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newPickupDate}
                    onChange={(e) => setNewPickupDate(e.target.value)}
                    className="border border-slate-300 rounded-xl p-2 text-xs"
                    required
                  />
                  <input
                    type="time"
                    value={newPickupTime}
                    onChange={(e) => setNewPickupTime(e.target.value)}
                    className="border border-slate-300 rounded-xl p-2 text-xs text-center"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Yeni İade Tarihi & Saati</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newReturnDate}
                    onChange={(e) => setNewReturnDate(e.target.value)}
                    className="border border-slate-300 rounded-xl p-2 text-xs"
                    required
                  />
                  <input
                    type="time"
                    value={newReturnTime}
                    onChange={(e) => setNewReturnTime(e.target.value)}
                    className="border border-slate-300 rounded-xl p-2 text-xs text-center"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChange}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {isSubmittingChange ? 'İletiliyor...' : 'Talebi İlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
