'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { User, CreateStaffDto, UpdateStaffPermissionsDto } from '@/types/api';
import { formatDateTime, maskPhone } from '@/lib/statusLabels';
import {
  Users,
  Plus,
  Shield,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Ban,
  RefreshCw,
  Key,
} from 'lucide-react';

export default function YonetimPersonelPage() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modallar
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);

  // Form State'leri
  const [createForm, setCreateForm] = useState<CreateStaffDto>({
    phone: '',
    email: '',
    password: '',
    canManageVehicles: false,
    canManageReservations: true,
    canManageUsers: false,
    canManageBranches: false,
    canManagePricing: false,
  });

  const [permForm, setPermForm] = useState<UpdateStaffPermissionsDto>({
    canManageVehicles: false,
    canManageReservations: false,
    canManageUsers: false,
    canManageBranches: false,
    canManagePricing: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.staff.list({ limit: 100 });
      setStaffList(data);
    } catch {
      setFeedback({ type: 'error', message: 'Personel listesi yüklenemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.admin.staff.create(createForm);
      setFeedback({ type: 'success', message: 'Yeni personel hesabı başarıyla oluşturuldu.' });
      setAddModalOpen(false);
      setCreateForm({
        phone: '',
        email: '',
        password: '',
        canManageVehicles: false,
        canManageReservations: true,
        canManageUsers: false,
        canManageBranches: false,
        canManagePricing: false,
      });
      loadStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Personel oluşturma başarısız.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setIsSubmitting(true);
    try {
      await api.admin.staff.updatePermissions(selectedStaff.id, permForm);
      setFeedback({ type: 'success', message: 'Personel modül yetkileri başarıyla güncellendi.' });
      setPermModalOpen(false);
      loadStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Yetki güncelleme başarısız.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (staff: User) => {
    if (!confirm(`${staff.email} hesabını pasife almak ve tüm açık oturumlarını kapatmak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await api.admin.staff.deactivate(staff.id);
      setFeedback({ type: 'success', message: 'Personel hesabı pasife alındı ve oturumları sonlandırıldı.' });
      loadStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İşlem başarısız.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  const openPermModal = (staff: User) => {
    setSelectedStaff(staff);
    const p = staff.staffPermission;
    setPermForm({
      canManageVehicles: p?.canManageVehicles || false,
      canManageReservations: p?.canManageReservations || false,
      canManageUsers: p?.canManageUsers || false,
      canManageBranches: p?.canManageBranches || false,
      canManagePricing: p?.canManagePricing || false,
    });
    setPermModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Aksiyon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personel Yönetimi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Şube personelleri, modül bazlı RBAC yetkileri ve operasyonel erişim denetimi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Personel Tanımla</span>
          </button>

          <button
            onClick={loadStaff}
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

      {/* Personel Tablosu */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
              <tr>
                <th className="px-5 py-4">E-posta / Telefon</th>
                <th className="px-5 py-4">Aktif Modül Yetkileri</th>
                <th className="px-5 py-4">Hesap Durumu</th>
                <th className="px-5 py-4">Oluşturulma Tarihi</th>
                <th className="px-5 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CBD5E1]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Personeller yükleniyor...</span>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Kayıtlı personel bulunamadı.
                  </td>
                </tr>
              ) : (
                staffList.map((st) => {
                  const perm = st.staffPermission;
                  const activePerms = [
                    perm?.canManageReservations && 'Rezervasyon & Teslimat',
                    perm?.canManageVehicles && 'Filo Yönetimi',
                    perm?.canManageBranches && 'Şubeler',
                    perm?.canManagePricing && 'Fiyatlandırma',
                    perm?.canManageUsers && 'Kullanıcılar',
                  ].filter(Boolean);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{st.email}</div>
                        <div className="font-mono text-xs text-slate-400">{maskPhone(st.phone)}</div>
                      </td>

                      <td className="px-5 py-4">
                        {activePerms.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {activePerms.map((p, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Yetki atanmadı</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            st.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {st.isActive ? 'Aktif' : 'Pasif / Askıya Alındı'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                        {formatDateTime(st.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openPermModal(st)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-[#CBD5E1] text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                            title="Yetkileri Düzenle"
                          >
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                            <span>Yetkiler</span>
                          </button>

                          {st.isActive && (
                            <button
                              onClick={() => handleDeactivate(st)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Personeli Pasife Al"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* YENİ PERSONEL MODALI */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between sticky top-0 bg-[#F8FAFC]">
              <div>
                <h3 className="text-base font-bold text-slate-900">Yeni Personel Hesabı Tanımla</h3>
                <p className="text-xs text-slate-500">Personel giriş bilgileri ve başlangıç yetkileri</p>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Cep Telefonu (+905XXXXXXXXX) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+905551234567"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-posta Adresi *</label>
                <input
                  type="email"
                  required
                  placeholder="personel.ahmet@earackiralama.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  İlk Giriş Parolası (En az 8 karakter) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Yetkilendirilecek Modüller
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.canManageReservations}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, canManageReservations: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Rezervasyon ve Şube Teslim/İade Yönetimi</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.canManageVehicles}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, canManageVehicles: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Filo ve Araç Durum Yönetimi</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.canManageBranches}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, canManageBranches: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Şube Bilgileri Yönetimi</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.canManagePricing}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, canManagePricing: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Fiyat Matrisi Yönetimi</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Hesabı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YETKİLERİ DÜZENLE MODALI */}
      {permModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Modül Yetkilerini Güncelle</h3>
                <p className="text-xs text-slate-500">{selectedStaff.email}</p>
              </div>
              <button onClick={() => setPermModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePermSubmit} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#CBD5E1] cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800">Rezervasyon & Teslimat</span>
                  <input
                    type="checkbox"
                    checked={permForm.canManageReservations}
                    onChange={(e) =>
                      setPermForm({ ...permForm, canManageReservations: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#CBD5E1] cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800">Filo & Araç Durumları</span>
                  <input
                    type="checkbox"
                    checked={permForm.canManageVehicles}
                    onChange={(e) =>
                      setPermForm({ ...permForm, canManageVehicles: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#CBD5E1] cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800">Şube Bilgileri</span>
                  <input
                    type="checkbox"
                    checked={permForm.canManageBranches}
                    onChange={(e) =>
                      setPermForm({ ...permForm, canManageBranches: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#CBD5E1] cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800">Fiyat Matrisi</span>
                  <input
                    type="checkbox"
                    checked={permForm.canManagePricing}
                    onChange={(e) =>
                      setPermForm({ ...permForm, canManagePricing: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPermModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Yetkileri Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
