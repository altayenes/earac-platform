'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PriceMatrixItem } from '@/types/api';
import { formatCurrency, getSegmentLabel } from '@/lib/statusLabels';
import {
  BadgePercent,
  Edit2,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';

export default function YonetimFiyatlarPage() {
  const [matrix, setMatrix] = useState<PriceMatrixItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Düzenle Modalı
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PriceMatrixItem | null>(null);
  const [newPrice, setNewPrice] = useState<number>(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.pricing.getMatrix();
      setMatrix(data);
    } catch {
      setFeedback({ type: 'error', message: 'Fiyat matrisi yüklenemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const openEditModal = (item: PriceMatrixItem) => {
    setSelectedItem(item);
    setNewPrice(item.dailyPrice);
    setEditModalOpen(true);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (newPrice < 100) {
      setFeedback({ type: 'error', message: 'Günlük kiralama bedeli en az ₺100,00 olmalıdır.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.admin.pricing.updatePrice(selectedItem.segmentId, selectedItem.bodyTypeId, {
        dailyPrice: Number(newPrice),
      });

      setFeedback({
        type: 'success',
        message: `${getSegmentLabel(selectedItem.segmentName)} - ${selectedItem.bodyTypeName} günlük fiyatı güncellendi.`,
      });
      setEditModalOpen(false);
      loadMatrix();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fiyat güncelleme başarısız.';
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Segment & Kasa Fiyat Matrisi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Segment ve gövde tipi bazında dinamik günlük kiralama taban birim fiyatları
          </p>
        </div>

        <button
          onClick={loadMatrix}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-xl text-slate-700 text-sm font-medium shadow-2xs self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Sabit İş Kuralları Bilgi Kartı (Hibrit Veri Yönetimi İlkesi) */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Hibrit Veri Yönetimi: Asgari Yaş & Ehliyet Şartları Sabittir</h4>
            <p className="text-xs text-blue-800 leading-relaxed">
              Segment bazlı yaş ve ehliyet sınırları backend kontrolünde sabit kod seviyesinde korunur; panelden
              değiştirilemez:
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold shrink-0">
          <span className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-slate-800">
            Ekonomik: <strong>21 Yaş / 2 Yıl Ehliyet</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-slate-800">
            Orta: <strong>23 Yaş / 3 Yıl Ehliyet</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-slate-800">
            Premium: <strong>25 Yaş / 5 Yıl Ehliyet</strong>
          </span>
        </div>
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

      {/* Fiyat Tablosu */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
              <tr>
                <th className="px-5 py-4">Segment</th>
                <th className="px-5 py-4">Kasa Tipi</th>
                <th className="px-5 py-4">Uygunluk Kuralı</th>
                <th className="px-5 py-4">Günlük Taban Fiyat</th>
                <th className="px-5 py-4">Durum</th>
                <th className="px-5 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CBD5E1]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Fiyat matrisi yükleniyor...</span>
                  </td>
                </tr>
              ) : matrix.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Tanımlı fiyat kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                matrix.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {getSegmentLabel(item.segmentName)}
                    </td>

                    <td className="px-5 py-4 text-slate-800 font-medium">
                      {item.bodyTypeName}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {item.minAge} Yaş / {item.minLicenseYears} Yıl Ehliyet
                    </td>

                    <td className="px-5 py-4 font-mono font-bold text-blue-700 text-base">
                      {formatCurrency(item.dailyPrice)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {item.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-[#CBD5E1] text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Fiyat Güncelle</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FİYAT GÜNCELLE MODALI */}
      {editModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-sm w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Günlük Fiyatı Güncelle</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePrice} className="p-6 space-y-4">
              <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Segment:</span>
                  <span className="font-semibold text-slate-800">{getSegmentLabel(selectedItem.segmentName)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasa Tipi:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.bodyTypeName}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Yeni Günlük Kiralama Bedeli (TRY) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                    ₺
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={100}
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-2 bg-white border border-[#CBD5E1] rounded-xl text-base font-bold font-mono text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Minimum ₺100,00</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Fiyatı Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
