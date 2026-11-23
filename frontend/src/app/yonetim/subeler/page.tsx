'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Branch, CreateBranchDto, UpdateBranchDto } from '@/types/api';
import {
  Building2,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Ban,
  RefreshCw,
} from 'lucide-react';

export default function YonetimSubelerPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State'leri
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<{
    name: string;
    address: string;
    openingTime: string;
    closingTime: string;
    isActive: boolean;
  }>({
    name: '',
    address: '',
    openingTime: '08:00',
    closingTime: '22:00',
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.branches.getAll(true); // Tüm şubeler (aktif + pasif)
      setBranches(data);
    } catch {
      setFeedback({ type: 'error', message: 'Şubeler yüklenirken hata oluştu.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const openAddModal = () => {
    setSelectedBranch(null);
    setForm({
      name: '',
      address: '',
      openingTime: '08:00',
      closingTime: '22:00',
      isActive: true,
    });
    setModalMode('ADD');
  };

  const openEditModal = (b: Branch) => {
    setSelectedBranch(b);
    setForm({
      name: b.name,
      address: b.address,
      openingTime: b.openingTime,
      closingTime: b.closingTime,
      isActive: b.isActive,
    });
    setModalMode('EDIT');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(form.openingTime) || !timeRegex.test(form.closingTime)) {
      setFeedback({
        type: 'error',
        message: 'Açılış ve kapanış saatleri HH:mm formatında olmalıdır (örn: 08:00, 22:00).',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'ADD') {
        const dto: CreateBranchDto = {
          name: form.name.trim(),
          address: form.address.trim(),
          openingTime: form.openingTime,
          closingTime: form.closingTime,
        };
        await api.branches.create(dto);
        setFeedback({ type: 'success', message: 'Yeni şube başarıyla eklendi.' });
      } else if (modalMode === 'EDIT' && selectedBranch) {
        const dto: UpdateBranchDto = {
          address: form.address.trim(),
          openingTime: form.openingTime,
          closingTime: form.closingTime,
          isActive: form.isActive,
        };
        await api.branches.update(selectedBranch.id, dto);
        setFeedback({ type: 'success', message: 'Şube bilgileri güncellendi.' });
      }

      setModalMode(null);
      loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız oldu.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (b: Branch) => {
    if (!confirm(`"${b.name}" şubesini pasife almak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await api.branches.deactivate(b.id);
      setFeedback({ type: 'success', message: `"${b.name}" şubesi pasife alındı.` });
      loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pasife alma işlemi başarısız.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Ekle Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Şube Yönetimi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Hizmet verilen lokasyonlar, çalışma saatleri ve operasyonel aktiflik durumu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Şube Ekle</span>
          </button>

          <button
            onClick={loadBranches}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-xl text-slate-700 shadow-2xs"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
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

      {/* Şube Kartları / Tablosu */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
              <tr>
                <th className="px-5 py-4">Şube Adı</th>
                <th className="px-5 py-4">Adres</th>
                <th className="px-5 py-4">Çalışma Saatleri</th>
                <th className="px-5 py-4">Durum</th>
                <th className="px-5 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CBD5E1]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Şubeler yükleniyor...</span>
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Kayıtlı şube bulunamadı.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span>{b.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-700 max-w-xs truncate">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{b.address}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {b.openingTime} - {b.closingTime}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          b.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {b.isActive ? 'Aktif Hizmette' : 'Pasif'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(b)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {b.isActive && (
                          <button
                            onClick={() => handleDeactivate(b)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Pasife Al"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ŞUBE EKLEME / DÜZENLEME MODALI */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'ADD' ? 'Yeni Şube Ekle' : 'Şube Bilgilerini Düzenle'}
              </h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Şube Adı *</label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'EDIT'}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Kadıköy Rıhtım Şube"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adres *</label>
                <textarea
                  rows={2}
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Açık adres..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Açılış Saati *</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="08:00"
                    value={form.openingTime}
                    onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono"
                  />
                  <span className="text-[10px] text-slate-400">HH:mm (örn: 08:30)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kapanış Saati *</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="22:00"
                    value={form.closingTime}
                    onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono"
                  />
                  <span className="text-[10px] text-slate-400">HH:mm (örn: 23:00)</span>
                </div>
              </div>

              {modalMode === 'EDIT' && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Şube Hizmete Açık (Aktif)</span>
                  </label>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
