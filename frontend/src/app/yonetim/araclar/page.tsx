'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  AdminVehicle,
  CreateVehicleDto,
  ReferenceCatalog,
  VehicleState,
} from '@/types/api';
import {
  formatCurrency,
  getVehicleStateBadgeClass,
  getVehicleStateLabel,
  getSegmentLabel,
  VEHICLE_STATE_LABELS,
} from '@/lib/statusLabels';
import {
  Car,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Wrench,
  Ban,
  Tag,
  RefreshCw,
  Edit2,
  Eye,
} from 'lucide-react';

export default function FiloVeKatalogPage() {
  const [activeMainTab, setActiveMainTab] = useState<'FLEET' | 'CATALOG'>('FLEET');
  const [catalogSubTab, setCatalogSubTab] = useState<'BRANDS' | 'MODELS' | 'BODY_TYPES' | 'FUEL_TYPES' | 'TRANSMISSIONS'>('BRANDS');

  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modallar
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<AdminVehicle | null>(null);
  const [addCatalogItemOpen, setAddCatalogItemOpen] = useState(false);

  // Form State'leri
  const [newVehicleForm, setNewVehicleForm] = useState<CreateVehicleDto>({
    vin: '',
    licensePlate: '',
    modelId: '',
    segmentId: '',
    bodyTypeId: '',
    fuelTypeId: '',
    transmissionId: '',
    branchId: '',
    year: new Date().getFullYear(),
    mileage: 0,
  });

  const [updateStateForm, setUpdateStateForm] = useState<{
    state: VehicleState;
    reason: string;
  }>({
    state: 'AVAILABLE',
    reason: '',
  });

  const [catalogItemForm, setCatalogItemForm] = useState<{
    name: string;
    brandId: string;
  }>({
    name: '',
    brandId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verileri yükle
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vRes, catRes, bRes] = await Promise.allSettled([
        api.admin.vehicles.getAll({ limit: 100 }),
        api.admin.references.getCatalog(),
        api.branches.getAll(),
      ]);

      let hasSuccess = false;

      if (vRes.status === 'fulfilled') {
        setVehicles(vRes.value);
        hasSuccess = true;
      }
      if (bRes.status === 'fulfilled') {
        setBranches(bRes.value.map((b) => ({ id: b.id, name: b.name })));
        hasSuccess = true;
      }
      if (catRes.status === 'fulfilled') {
        const catData = catRes.value;
        setCatalog(catData);
        hasSuccess = true;

        const defaultBranchId = bRes.status === 'fulfilled' && bRes.value[0]?.id ? bRes.value[0].id : '';
        if (catData.models.length > 0 && catData.segments.length > 0) {
          setNewVehicleForm((prev) => ({
            ...prev,
            modelId: prev.modelId || catData.models[0].id,
            segmentId: prev.segmentId || catData.segments[0].id,
            bodyTypeId: prev.bodyTypeId || catData.bodyTypes[0]?.id || '',
            fuelTypeId: prev.fuelTypeId || catData.fuelTypes[0]?.id || '',
            transmissionId: prev.transmissionId || catData.transmissionTypes[0]?.id || '',
            branchId: prev.branchId || defaultBranchId,
          }));
        }
      }

      if (!hasSuccess) {
        setFeedback({ type: 'error', message: 'Filo ve referans verileri yüklenemedi.' });
      }
    } catch {
      // Beklenmeyen hata
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Yeni Araç Ekle Submit
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(newVehicleForm.vin.trim())) {
      setFeedback({
        type: 'error',
        message: 'VIN numarası standart 17 haneli formatta olmalıdır (I, O, Q harfleri hariç).',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.admin.vehicles.create({
        ...newVehicleForm,
        vin: newVehicleForm.vin.trim().toUpperCase(),
        licensePlate: newVehicleForm.licensePlate.trim().toUpperCase(),
        year: Number(newVehicleForm.year),
        mileage: Number(newVehicleForm.mileage || 0),
      });

      setFeedback({ type: 'success', message: 'Yeni araç başarıyla filoya eklendi.' });
      setAddVehicleOpen(false);
      setNewVehicleForm({
        vin: '',
        licensePlate: '',
        modelId: catalog?.models[0]?.id || '',
        segmentId: catalog?.segments[0]?.id || '',
        bodyTypeId: catalog?.bodyTypes[0]?.id || '',
        fuelTypeId: catalog?.fuelTypes[0]?.id || '',
        transmissionId: catalog?.transmissionTypes[0]?.id || '',
        branchId: branches[0]?.id || '',
        year: new Date().getFullYear(),
        mileage: 0,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Araç eklenirken hata oluştu.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Durum Değiştir Submit (5 Durumlu State Machine)
  const handleUpdateStateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    setIsSubmitting(true);
    try {
      await api.admin.vehicles.updateState(selectedVehicle.id, {
        state: updateStateForm.state,
        reason: updateStateForm.reason || undefined,
      });

      setFeedback({
        type: 'success',
        message: `${selectedVehicle.licensePlate} plakalı aracın durumu başarıyla güncellendi.`,
      });
      setStateModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Durum değişikliği başarısız oldu.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Araç Pasife Al
  const handleDeactivateVehicle = async (v: AdminVehicle) => {
    if (!confirm(`${v.licensePlate} plakalı aracı pasife almak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await api.admin.vehicles.update(v.id, { isActive: false });
      setFeedback({ type: 'success', message: `${v.licensePlate} aracı pasife alındı.` });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pasife alma işlemi başarısız.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  // Referans Veri Ekleme Submit
  const handleAddCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogItemForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const name = catalogItemForm.name.trim();
      switch (catalogSubTab) {
        case 'BRANDS':
          await api.admin.references.createBrand(name);
          break;
        case 'MODELS':
          if (!catalogItemForm.brandId) {
            setFeedback({ type: 'error', message: 'Lütfen bir marka seçin.' });
            setIsSubmitting(false);
            return;
          }
          await api.admin.references.createModel({
            brandId: catalogItemForm.brandId,
            name,
          });
          break;
        case 'BODY_TYPES':
          await api.admin.references.createBodyType(name);
          break;
        case 'FUEL_TYPES':
          await api.admin.references.createFuelType(name);
          break;
        case 'TRANSMISSIONS':
          await api.admin.references.createTransmission(name);
          break;
      }

      setFeedback({ type: 'success', message: 'Referans verisi başarıyla eklendi.' });
      setAddCatalogItemOpen(false);
      setCatalogItemForm({ name: '', brandId: '' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Referans ekleme başarısız.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Referans Veriyi Pasife Al (Fiziksel Silme Yasak!)
  const handleDeactivateCatalogItem = async (type: string, id: string, name: string) => {
    if (!confirm(`"${name}" referans kaydını pasife almak istediğinize emin misiniz? (Geçmiş kayıt bütünlüğü korunacaktır)`)) {
      return;
    }

    try {
      switch (type) {
        case 'BRANDS':
          await api.admin.references.deactivateBrand(id);
          break;
        case 'MODELS':
          await api.admin.references.deactivateModel(id);
          break;
        case 'BODY_TYPES':
          await api.admin.references.deactivateBodyType(id);
          break;
        case 'FUEL_TYPES':
          await api.admin.references.deactivateFuelType(id);
          break;
        case 'TRANSMISSIONS':
          await api.admin.references.deactivateTransmission(id);
          break;
      }
      setFeedback({ type: 'success', message: `"${name}" başarıyla pasife alındı.` });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pasife alma işlemi başarısız.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  // Filtreleme
  const filteredVehicles = vehicles.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      v.licensePlate.toLowerCase().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      v.brandName.toLowerCase().includes(q) ||
      v.modelName.toLowerCase().includes(q) ||
      v.branchName.toLowerCase().includes(q);
    const matchState = stateFilter === 'ALL' || v.state === stateFilter;
    return matchSearch && matchState;
  });

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Filo & Referans Katalog Yönetimi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Plakalı araç envanteri, operasyonel durum geçişleri ve referans tanımlamaları
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeMainTab === 'FLEET' ? (
            <button
              onClick={() => setAddVehicleOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Araç Ekle</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setCatalogItemForm({ name: '', brandId: catalog?.brands[0]?.id || '' });
                setAddCatalogItemOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Tanım Ekle</span>
            </button>
          )}

          <button
            onClick={loadData}
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

      {/* Ana Sekmeler */}
      <div className="flex border-b border-[#CBD5E1] gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveMainTab('FLEET')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeMainTab === 'FLEET'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Araç Filosu ({vehicles.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('CATALOG')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeMainTab === 'CATALOG'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Referans Katalogları</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. SEKMELER: ARAÇ FİLOSU */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'FLEET' && (
        <div className="space-y-4">
          {/* Arama ve Filtreler */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Plaka, VIN, marka, model ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">Tüm Durumlar</option>
                <option value="AVAILABLE">Müsait</option>
                <option value="RENTED">Kirada</option>
                <option value="MAINTENANCE">Bakımda</option>
                <option value="DAMAGED_OUT_OF_SERVICE">Hasarlı / Hizmet Dışı</option>
                <option value="INACTIVE">Pasif</option>
              </select>
            </div>
          </div>

          {/* Filo Tablosu */}
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
                  <tr>
                    <th className="px-5 py-4">Plaka / VIN</th>
                    <th className="px-5 py-4">Araç / Model</th>
                    <th className="px-5 py-4">Segment & Kasa</th>
                    <th className="px-5 py-4">Şube</th>
                    <th className="px-5 py-4">KM</th>
                    <th className="px-5 py-4">Durum</th>
                    <th className="px-5 py-4 text-right">İşlem</th>
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
                  ) : filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        Kayıtlı araç bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v) => {
                      const badge = getVehicleStateBadgeClass(v.state);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-mono font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded text-xs">
                              {v.licensePlate}
                            </span>
                            <div className="font-mono text-[11px] text-slate-400 mt-0.5">{v.vin}</div>
                          </td>

                          <td className="px-5 py-4 font-medium text-slate-900">
                            {v.brandName} {v.modelName}
                            <span className="text-xs text-slate-400 font-normal ml-1">({v.year})</span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-slate-800">{getSegmentLabel(v.segmentName)}</div>
                            <div className="text-xs text-slate-400">{v.bodyTypeName} - {v.fuelTypeName}</div>
                          </td>

                          <td className="px-5 py-4 text-slate-800">{v.branchName}</td>

                          <td className="px-5 py-4 font-mono font-medium text-slate-900">
                            {v.mileage.toLocaleString('tr-TR')} KM
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {getVehicleStateLabel(v.state)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setUpdateStateForm({ state: v.state, reason: '' });
                                  setStateModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-[#CBD5E1] text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                title="Durum Değiştir"
                              >
                                Durum
                              </button>

                              {v.isActive && (
                                <button
                                  onClick={() => handleDeactivateVehicle(v)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Pasife Al"
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
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SEKMELER: REFERANS KATALOGLARI */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'CATALOG' && (
        <div className="space-y-4">
          {/* Alt Sekmeler */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-xl border border-[#CBD5E1]">
            {[
              { id: 'BRANDS', label: 'Markalar' },
              { id: 'MODELS', label: 'Modeller' },
              { id: 'BODY_TYPES', label: 'Kasa Tipleri' },
              { id: 'FUEL_TYPES', label: 'Yakıt Tipleri' },
              { id: 'TRANSMISSIONS', label: 'Vites Tipleri' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCatalogSubTab(tab.id as typeof catalogSubTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  catalogSubTab === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Katalog Listesi */}
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
                  <tr>
                    <th className="px-5 py-4">Adı</th>
                    {catalogSubTab === 'MODELS' && <th className="px-5 py-4">Bağlı Marka</th>}
                    <th className="px-5 py-4">Durum</th>
                    <th className="px-5 py-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]">
                  {(() => {
                    if (!catalog) return null;
                    let list: { id: string; name: string; isActive: boolean; brandId?: string }[] = [];
                    if (catalogSubTab === 'BRANDS') list = catalog.brands;
                    else if (catalogSubTab === 'MODELS') list = catalog.models;
                    else if (catalogSubTab === 'BODY_TYPES') list = catalog.bodyTypes;
                    else if (catalogSubTab === 'FUEL_TYPES') list = catalog.fuelTypes;
                    else if (catalogSubTab === 'TRANSMISSIONS') list = catalog.transmissionTypes;

                    if (list.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                            Tanımlı kayıt bulunamadı.
                          </td>
                        </tr>
                      );
                    }

                    return list.map((item) => {
                      const brandName = catalog.brands.find((b) => b.id === item.brandId)?.name || '-';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-semibold text-slate-900">{item.name}</td>
                          {catalogSubTab === 'MODELS' && <td className="px-5 py-4 text-slate-600">{brandName}</td>}
                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                item.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {item.isActive ? 'Aktif' : 'Pasif'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {item.isActive && (
                              <button
                                onClick={() => handleDeactivateCatalogItem(catalogSubTab, item.id, item.name)}
                                className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-medium border border-rose-200"
                              >
                                Pasife Al
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* YENİ ARAÇ EKLE MODALI */}
      {addVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between sticky top-0 bg-[#F8FAFC]">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Filoya Yeni Araç Ekle</h3>
                <p className="text-xs text-slate-500">Plaka, VIN ve teknik referans tanımları</p>
              </div>
              <button onClick={() => setAddVehicleOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVehicleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    17 Haneli VIN (Şasi No) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={17}
                    value={newVehicleForm.vin}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, vin: e.target.value.toUpperCase() })}
                    placeholder="WBA33AY07N..."
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Plaka *</label>
                  <input
                    type="text"
                    required
                    value={newVehicleForm.licensePlate}
                    onChange={(e) =>
                      setNewVehicleForm({ ...newVehicleForm, licensePlate: e.target.value.toUpperCase() })
                    }
                    placeholder="34 ABC 789"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Araç Modeli *</label>
                  <select
                    value={newVehicleForm.modelId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, modelId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {catalog?.models.filter((m) => m.isActive).map((m) => {
                      const bName = catalog.brands.find((b) => b.id === m.brandId)?.name || '';
                      return (
                        <option key={m.id} value={m.id}>
                          {bName} {m.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Segment *</label>
                  <select
                    value={newVehicleForm.segmentId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, segmentId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {catalog?.segments.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kasa Tipi *</label>
                  <select
                    value={newVehicleForm.bodyTypeId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, bodyTypeId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {catalog?.bodyTypes.filter((b) => b.isActive).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Yakıt Tipi *</label>
                  <select
                    value={newVehicleForm.fuelTypeId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, fuelTypeId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {catalog?.fuelTypes.filter((f) => f.isActive).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vites Tipi *</label>
                  <select
                    value={newVehicleForm.transmissionId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, transmissionId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {catalog?.transmissionTypes.filter((t) => t.isActive).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bulunduğu Şube *</label>
                  <select
                    value={newVehicleForm.branchId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, branchId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {branches.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Model Yılı *</label>
                  <input
                    type="number"
                    min={2010}
                    max={2030}
                    value={newVehicleForm.year}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, year: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Güncel KM *</label>
                  <input
                    type="number"
                    min={0}
                    value={newVehicleForm.mileage}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, mileage: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddVehicleOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Filoya Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DURUM DEĞİŞTİR MODALI (STATE MACHINE) */}
      {stateModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Araç Durum Geçişi</h3>
                <p className="text-xs text-slate-500">{selectedVehicle.licensePlate} - Mevcut: {getVehicleStateLabel(selectedVehicle.state)}</p>
              </div>
              <button onClick={() => setStateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Yeni Durum *</label>
                <select
                  value={updateStateForm.state}
                  onChange={(e) =>
                    setUpdateStateForm({ ...updateStateForm, state: e.target.value as VehicleState })
                  }
                  required
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                >
                  <option value="AVAILABLE">Müsait</option>
                  <option value="MAINTENANCE">Bakımda / Serviste</option>
                  <option value="DAMAGED_OUT_OF_SERVICE">Hasarlı / Hizmet Dışı</option>
                  <option value="INACTIVE">Pasif</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * Kirada durumu manuel seçilemez, yalnızca teslimat operasyonu ile otomatik tetiklenir.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Değişiklik Gerekçesi (Opsiyonel)
                </label>
                <textarea
                  rows={2}
                  value={updateStateForm.reason}
                  onChange={(e) => setUpdateStateForm({ ...updateStateForm, reason: e.target.value })}
                  placeholder="Periyodik bakım, parça değişimi, servis kontrolü..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Güncelleniyor...' : 'Durumu Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YENİ REFERANS KATALOG TANIMI MODALI */}
      {addCatalogItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-sm w-full">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Yeni Referans Tanımı Ekle
              </h3>
              <button onClick={() => setAddCatalogItemOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCatalogItem} className="p-6 space-y-4">
              {catalogSubTab === 'MODELS' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bağlı Marka *</label>
                  <select
                    value={catalogItemForm.brandId}
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, brandId: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900"
                  >
                    {catalog?.brands.filter((b) => b.isActive).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanım Adı *</label>
                <input
                  type="text"
                  required
                  value={catalogItemForm.name}
                  onChange={(e) => setCatalogItemForm({ ...catalogItemForm, name: e.target.value })}
                  placeholder="Örn: Corolla, Sedan, Benzin..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddCatalogItemOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Ekleniyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
