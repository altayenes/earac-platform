'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { ProfileCorrectionRequestItem, PaginationMeta } from '@/types/api';
import { formatDateTime, formatDate, maskPhone } from '@/lib/statusLabels';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
} from 'lucide-react';

export default function YonetimDuzeltmeTalepleriPage() {
  const [requests, setRequests] = useState<ProfileCorrectionRequestItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // İnceleme Modalı
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<ProfileCorrectionRequestItem | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.admin.profileCorrections.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
      });
      setRequests(res.data || []);
      setMeta(res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch {
      setFeedback({ type: 'error', message: 'Kimlik düzeltme talepleri yüklenemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setIsSubmitting(true);
    try {
      await api.admin.profileCorrections.review(selectedReq.id, {
        status: decision,
        adminNote: adminNote || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Kimlik düzeltme talebi ${decision === 'APPROVED' ? 'onaylandı ve profil güncellendi' : 'reddedildi'}.`,
      });
      setReviewModalOpen(false);
      loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kimlik & Profil Düzeltme Talepleri</h1>
          <p className="text-sm text-slate-600 mt-1">
            Müşterilerin kilitli kimlik verileri için sundukları gerekçeli değişiklik talepleri
          </p>
        </div>

        <button
          onClick={loadRequests}
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

      {/* Durum Filtresi */}
      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1] self-start w-fit">
        <span className="text-xs font-semibold text-slate-500">Filtre:</span>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs font-medium text-slate-800 bg-transparent focus:outline-hidden"
        >
          <option value="">Tümü</option>
          <option value="PENDING">Beklemede (İnceleme Bekleyenler)</option>
          <option value="APPROVED">Onaylananlar</option>
          <option value="REJECTED">Reddedilenler</option>
        </select>
      </div>

      {/* Talepler Tablosu */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
              <tr>
                <th className="px-5 py-4">Müşteri</th>
                <th className="px-5 py-4">Talep Edilen Düzeltmeler</th>
                <th className="px-5 py-4">Gerekçe Açıklaması</th>
                <th className="px-5 py-4">Durum</th>
                <th className="px-5 py-4">Talep Zamanı</th>
                <th className="px-5 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CBD5E1]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Talepler yükleniyor...</span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Kimlik düzeltme talebi bulunamadı.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{req.user?.email || 'Müşteri'}</div>
                      <div className="font-mono text-xs text-slate-400">{maskPhone(req.user?.phone || '')}</div>
                    </td>

                    <td className="px-5 py-4 text-xs space-y-0.5">
                      {(req.requestedFirstName || req.requestedLastName) && (
                        <div>
                          <span className="text-slate-400">Ad Soyad: </span>
                          <span className="font-semibold text-slate-800">
                            {req.requestedFirstName} {req.requestedLastName}
                          </span>
                        </div>
                      )}
                      {req.requestedBirthDate && (
                        <div>
                          <span className="text-slate-400">Doğum: </span>
                          <span>{formatDate(req.requestedBirthDate)}</span>
                        </div>
                      )}
                      {req.requestedLicenseDate && (
                        <div>
                          <span className="text-slate-400">Ehliyet: </span>
                          <span>{formatDate(req.requestedLicenseDate)}</span>
                        </div>
                      )}
                      {req.requestedNationalId && (
                        <div>
                          <span className="text-slate-400">TCKN: </span>
                          <span className="font-mono">{req.requestedNationalId.slice(0, 3)}*****{req.requestedNationalId.slice(-2)}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-700 max-w-xs truncate">
                      {req.reason}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {req.status === 'APPROVED' ? 'Onaylandı' : req.status === 'REJECTED' ? 'Reddedildi' : 'İnceleme Bekliyor'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                      {formatDateTime(req.createdAt)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {req.status === 'PENDING' && (
                        <button
                          onClick={() => {
                            setSelectedReq(req);
                            setDecision('APPROVED');
                            setAdminNote('');
                            setReviewModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
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

        {meta.totalPages > 1 && (
          <div className="p-4 border-t border-[#CBD5E1] flex items-center justify-between text-xs text-slate-600">
            <span>
              Toplam {meta.total} talep (Sayfa {meta.page} / {meta.totalPages})
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* İNCELEME MODALI */}
      {reviewModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Kimlik Talebini Karara Bağla</h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-100 rounded-xl space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Müşteri Gerekçesi:</span>
                  <p className="font-medium text-slate-800 mt-0.5">{selectedReq.reason}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Karar *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      decision === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Onayla & Güncelle
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECTED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      decision === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Talebi Reddet
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Yönetici İnceleme Notu (Opsiyonel)
                </label>
                <textarea
                  rows={2}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Resmi kimlik belgesi teyit edildi veya uyumsuz bilgi..."
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
                  {isSubmitting ? 'İşleniyor...' : 'Kararı Uygula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
