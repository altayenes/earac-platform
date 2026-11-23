'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Reservation,
  ReservationChangeRequest,
  PaginationMeta,
} from '@/types/api';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeClass,
  getReservationStatusLabel,
  getSegmentLabel,
} from '@/lib/statusLabels';
import {
  CalendarCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Clock,
  Car,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  GitPullRequest,
  Eye,
} from 'lucide-react';

export default function YonetimRezervasyonlarPage() {
  const [activeTab, setActiveTab] = useState<'RESERVATIONS' | 'CHANGE_REQUESTS'>('RESERVATIONS');

  // Rezervasyon Listesi State'leri
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resMeta, setResMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [resPage, setResPage] = useState(1);
  const [resStateFilter, setResStateFilter] = useState('');
  const [resBranchFilter, setResBranchFilter] = useState('');

  // Değişiklik Talepleri State'leri
  const [changeRequests, setChangeRequests] = useState<ReservationChangeRequest[]>([]);
  const [crMeta, setCrMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [crPage, setCrPage] = useState(1);
  const [crStatusFilter, setCrStatusFilter] = useState('PENDING');

  // Şube Listesi
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detay Modalı
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);

  // Değişiklik Talebi İnceleme Modalı
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedCr, setSelectedCr] = useState<ReservationChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Veri Çekme
  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.admin.reservations.getAll({
        page: resPage,
        limit: 10,
        state: resStateFilter || undefined,
        branchId: resBranchFilter || undefined,
      });
      setReservations(res.data || []);
      setResMeta(res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch {
      setFeedback({ type: 'error', message: 'Rezervasyonlar yüklenemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, [resPage, resStateFilter, resBranchFilter]);

  const loadChangeRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const cr = await api.admin.reservations.getChangeRequests({
        page: crPage,
        limit: 10,
        status: crStatusFilter || undefined,
      });
      setChangeRequests(cr.data || []);
      setCrMeta(cr.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch {
      setFeedback({ type: 'error', message: 'Değişiklik talepleri yüklenemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, [crPage, crStatusFilter]);

  useEffect(() => {
    api.branches.getAll().then((b) => setBranches(b.map((item) => ({ id: item.id, name: item.name }))));
  }, []);

  useEffect(() => {
    if (activeTab === 'RESERVATIONS') {
      loadReservations();
    } else {
      loadChangeRequests();
    }
  }, [activeTab, loadReservations, loadChangeRequests]);

  // Değişiklik Talebi Onayla/Reddet
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCr) return;

    setIsSubmitting(true);
    try {
      await api.admin.reservations.reviewChangeRequest(selectedCr.id, {
        status: reviewAction,
        reviewNote: reviewNote || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Değişiklik talebi ${reviewAction === 'APPROVED' ? 'onaylandı' : 'reddedildi'}.`,
      });
      setReviewModalOpen(false);
      loadChangeRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rezervasyon Yönetimi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Müşteri rezervasyonları, ödeme durumları ve tarih/araç değişiklik talepleri
          </p>
        </div>

        <button
          onClick={() => (activeTab === 'RESERVATIONS' ? loadReservations() : loadChangeRequests())}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-xl text-slate-700 text-sm font-medium shadow-2xs self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Geri Bildirim */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ana Sekmeler */}
      <div className="flex border-b border-[#CBD5E1] gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('RESERVATIONS')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'RESERVATIONS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Tüm Rezervasyonlar ({resMeta.total})</span>
        </button>

        <button
          onClick={() => setActiveTab('CHANGE_REQUESTS')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'CHANGE_REQUESTS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitPullRequest className="w-4 h-4" />
          <span>Değişiklik Talepleri</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. SEKMELER: TÜM REZERVASYONLAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'RESERVATIONS' && (
        <div className="space-y-4">
          {/* Filtreler */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1]">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={resStateFilter}
                onChange={(e) => {
                  setResStateFilter(e.target.value);
                  setResPage(1);
                }}
                className="text-xs font-medium text-slate-800 bg-transparent focus:outline-hidden"
              >
                <option value="">Tüm Durumlar</option>
                <option value="PENDING_PAYMENT">Ödeme Bekliyor</option>
                <option value="CONFIRMED">Onaylandı</option>
                <option value="ACTIVE">Kirada</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="CANCELLED">İptal Edildi</option>
                <option value="NO_SHOW">Teslim Alınmadı</option>
                <option value="EXPIRED">Süresi Doldu</option>
              </select>
            </div>

            <div className="bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1]">
              <select
                value={resBranchFilter}
                onChange={(e) => {
                  setResBranchFilter(e.target.value);
                  setResPage(1);
                }}
                className="text-xs font-medium text-slate-800 bg-transparent focus:outline-hidden"
              >
                <option value="">Tüm Şubeler</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rezervasyon Tablosu */}
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
                  <tr>
                    <th className="px-5 py-4">Rez. Kodu / Müşteri</th>
                    <th className="px-5 py-4">Araç Grubu</th>
                    <th className="px-5 py-4">Şube</th>
                    <th className="px-5 py-4">Kiralama Tarihleri</th>
                    <th className="px-5 py-4">Tutar</th>
                    <th className="px-5 py-4">Durum</th>
                    <th className="px-5 py-4 text-right">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Yükleniyor...</span>
                      </td>
                    </tr>
                  ) : reservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        Rezervasyon kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    reservations.map((res) => {
                      const badge = getStatusBadgeClass(res.state);
                      const customerName = res.customer?.customerProfile
                        ? `${res.customer.customerProfile.firstName} ${res.customer.customerProfile.lastName}`
                        : res.customer?.phone || 'Müşteri';

                      return (
                        <tr key={res.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="font-mono text-xs font-bold text-slate-800">
                              #{res.id.slice(0, 8).toUpperCase()}
                            </div>
                            <div className="text-xs text-slate-500">{customerName}</div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {getSegmentLabel(res.priceSnapshot?.segmentName || '')} - {res.priceSnapshot?.bodyTypeName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {res.priceSnapshot?.fuelTypeName} / {res.priceSnapshot?.transmissionTypeName}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-slate-800">{res.branchName}</td>

                          <td className="px-5 py-4 text-xs">
                            <div className="text-slate-800 font-medium">{formatDateTime(res.startTime)}</div>
                            <div className="text-slate-400">{formatDateTime(res.endTime)}</div>
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-900 font-mono">
                            {formatCurrency(res.priceSnapshot?.totalAmount || 0)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {getReservationStatusLabel(res.state)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => setSelectedRes(res)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Detay Görüntüle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {resMeta.totalPages > 1 && (
              <div className="p-4 border-t border-[#CBD5E1] flex items-center justify-between text-xs text-slate-600">
                <span>
                  Toplam {resMeta.total} rezervasyon (Sayfa {resMeta.page} / {resMeta.totalPages})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={resPage <= 1}
                    onClick={() => setResPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={resPage >= resMeta.totalPages}
                    onClick={() => setResPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SEKMELER: DEĞİŞİKLİK TALEPLERİ */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'CHANGE_REQUESTS' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1] self-start w-fit">
            <span className="text-xs font-semibold text-slate-500">Talep Durumu:</span>
            <select
              value={crStatusFilter}
              onChange={(e) => {
                setCrStatusFilter(e.target.value);
                setCrPage(1);
              }}
              className="text-xs font-medium text-slate-800 bg-transparent focus:outline-hidden"
            >
              <option value="">Tümü</option>
              <option value="PENDING">Beklemede (Onay Bekleyenler)</option>
              <option value="APPROVED">Onaylananlar</option>
              <option value="REJECTED">Reddedilenler</option>
            </select>
          </div>

          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
                  <tr>
                    <th className="px-5 py-4">Rezervasyon ID</th>
                    <th className="px-5 py-4">Talep Edilen Tarihler</th>
                    <th className="px-5 py-4">Fiyat Farkı</th>
                    <th className="px-5 py-4">Durum</th>
                    <th className="px-5 py-4">Talep Tarihi</th>
                    <th className="px-5 py-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Yükleniyor...</span>
                      </td>
                    </tr>
                  ) : changeRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Bekleyen değişiklik talebi yok.
                      </td>
                    </tr>
                  ) : (
                    changeRequests.map((cr) => (
                      <tr key={cr.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-mono font-bold text-slate-900">
                          #{cr.reservationId.slice(0, 8).toUpperCase()}
                        </td>

                        <td className="px-5 py-4 text-xs">
                          {cr.requestedPickupAt && (
                            <div>Alış: {formatDateTime(cr.requestedPickupAt)}</div>
                          )}
                          {cr.requestedReturnAt && (
                            <div className="text-slate-500">İade: {formatDateTime(cr.requestedReturnAt)}</div>
                          )}
                          {!cr.requestedPickupAt && !cr.requestedReturnAt && (
                            <span className="text-slate-400">Tarih Değişmedi (Grup Değişimi)</span>
                          )}
                        </td>

                        <td className="px-5 py-4 font-mono font-semibold text-slate-900">
                          {cr.priceDifference !== null && cr.priceDifference !== undefined
                            ? formatCurrency(cr.priceDifference)
                            : '-'}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              cr.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : cr.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {cr.status === 'APPROVED' ? 'Onaylandı' : cr.status === 'REJECTED' ? 'Reddedildi' : 'Beklemede'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500">
                          {formatDateTime(cr.createdAt)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {cr.status === 'PENDING' && (
                            <button
                              onClick={() => {
                                setSelectedCr(cr);
                                setReviewAction('APPROVED');
                                setReviewNote('');
                                setReviewModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                            >
                              İncele
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {crMeta.totalPages > 1 && (
              <div className="p-4 border-t border-[#CBD5E1] flex items-center justify-between text-xs text-slate-600">
                <span>
                  Toplam {crMeta.total} talep (Sayfa {crMeta.page} / {crMeta.totalPages})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={crPage <= 1}
                    onClick={() => setCrPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={crPage >= crMeta.totalPages}
                    onClick={() => setCrPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REZERVASYON DETAY MODALI */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between sticky top-0 bg-[#F8FAFC]">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rezervasyon Detayı #{selectedRes.id.slice(0, 8).toUpperCase()}
                </h3>
                <span className="text-xs text-slate-500">{formatDateTime(selectedRes.createdAt)}</span>
              </div>
              <button onClick={() => setSelectedRes(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="p-3.5 bg-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Müşteri ID:</span>
                  <span className="font-mono text-slate-700">{selectedRes.customerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Şube:</span>
                  <span className="font-semibold text-slate-800">{selectedRes.branchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Durum:</span>
                  <span className="font-bold text-blue-600">{getReservationStatusLabel(selectedRes.state)}</span>
                </div>
              </div>

              {selectedRes.priceSnapshot && (
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fiyat Özeti</h4>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Segment & Kasa:</span>
                    <span className="font-semibold text-slate-800">
                      {getSegmentLabel(selectedRes.priceSnapshot.segmentName || '')} - {selectedRes.priceSnapshot.bodyTypeName}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Günlük Bedel:</span>
                    <span>{formatCurrency(selectedRes.priceSnapshot.dailyPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Toplam Gün:</span>
                    <span>{selectedRes.priceSnapshot.totalDays} Gün</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
                    <span>Toplam Tutar:</span>
                    <span className="text-blue-600">{formatCurrency(selectedRes.priceSnapshot.totalAmount)}</span>
                  </div>
                </div>
              )}

              {selectedRes.vehicle && (
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1 text-xs">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Atanmış Fiziksel Araç</h4>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plaka:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRes.vehicle.licensePlate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">VIN:</span>
                    <span className="font-mono text-slate-700">{selectedRes.vehicle.vin}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DEĞİŞİKLİK TALEBİ İNCELEME MODALI */}
      {reviewModalOpen && selectedCr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Değişiklik Talebini İncele</h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rezervasyon ID:</span>
                  <span className="font-mono">{selectedCr.reservationId.slice(0, 8)}...</span>
                </div>
                {selectedCr.priceDifference !== null && (
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-600">Oluşacak Fiyat Farkı:</span>
                    <span className="text-blue-600">{formatCurrency(selectedCr.priceDifference)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Karar *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      reviewAction === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECTED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      reviewAction === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Reddet
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">İnceleme Notu</label>
                <textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Müsaitlik doğrulandı veya yetersiz kapasite gerekçesi..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'İşleniyor...' : 'Kararı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
