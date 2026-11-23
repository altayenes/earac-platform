'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Reservation,
  AdminVehicle,
  DeliverVehicleDto,
  ReturnVehicleDto,
} from '@/types/api';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  getStatusBadgeClass,
  getReservationStatusLabel,
  getSegmentLabel,
} from '@/lib/statusLabels';
import {
  KeyRound,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  Search,
  UserX,
  FileText,
  Fuel,
  Gauge,
  X,
  RefreshCw,
} from 'lucide-react';

export default function TeslimatOperasyonPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'DELIVERIES' | 'RETURNS'>('DELIVERIES');
  const [deliveries, setDeliveries] = useState<Reservation[]>([]);
  const [returns, setReturns] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Teslimat Modalı State'leri
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [selectedResForDeliver, setSelectedResForDeliver] = useState<Reservation | null>(null);
  const [eligibleVehicles, setEligibleVehicles] = useState<AdminVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [deliverForm, setDeliverForm] = useState<{
    vehicleId: string;
    mileageOut: number;
    fuelLevelOut: number;
    isExceptionUpgrade: boolean;
    customerApproved: boolean;
    notes: string;
  }>({
    vehicleId: '',
    mileageOut: 0,
    fuelLevelOut: 100,
    isExceptionUpgrade: false,
    customerApproved: false,
    notes: '',
  });

  // İade Modalı State'leri
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedResForReturn, setSelectedResForReturn] = useState<Reservation | null>(null);
  const [returnForm, setReturnForm] = useState<{
    mileageIn: number;
    fuelLevelIn: number;
    hasDamage: boolean;
    damageNotes: string;
    notes: string;
  }>({
    mileageIn: 0,
    fuelLevelIn: 100,
    hasDamage: false,
    damageNotes: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verileri Çek
  const fetchOperationsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // CONFIRMED (Teslimat Bekleyenler)
      const confirmedRes = await api.admin.reservations.getAll({
        state: 'CONFIRMED',
        limit: 100,
      });
      setDeliveries(confirmedRes.data || []);

      // ACTIVE (İade Bekleyenler)
      const activeRes = await api.admin.reservations.getAll({
        state: 'ACTIVE',
        limit: 100,
      });
      setReturns(activeRes.data || []);
    } catch {
      setFeedback({ type: 'error', message: 'Operasyonel rezervasyon listesi yüklenemedi.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperationsData();
  }, [fetchOperationsData]);

  // Teslimat modalını aç
  const openDeliverModal = async (res: Reservation) => {
    setSelectedResForDeliver(res);
    setDeliverModalOpen(true);
    setLoadingVehicles(true);
    setDeliverForm({
      vehicleId: '',
      mileageOut: 0,
      fuelLevelOut: 100,
      isExceptionUpgrade: false,
      customerApproved: false,
      notes: '',
    });

    try {
      const response = await api.handover.getEligibleVehicles(res.id);
      const vehicles = response.data || [];
      setEligibleVehicles(vehicles);
      if (vehicles.length > 0) {
        setDeliverForm((prev) => ({
          ...prev,
          vehicleId: vehicles[0].id,
          mileageOut: vehicles[0].mileage || 0,
        }));
      }
    } catch {
      setEligibleVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  // İade modalını aç
  const openReturnModal = (res: Reservation) => {
    setSelectedResForReturn(res);
    setReturnModalOpen(true);
    const initialMileage = res.vehicle?.mileage || 0;
    setReturnForm({
      mileageIn: initialMileage,
      fuelLevelIn: 100,
      hasDamage: false,
      damageNotes: '',
      notes: '',
    });
  };

  // Teslim Et Submit
  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResForDeliver || !deliverForm.vehicleId) {
      setFeedback({ type: 'error', message: 'Lütfen teslim edilecek aracı seçiniz.' });
      return;
    }

    if (deliverForm.isExceptionUpgrade && !deliverForm.customerApproved) {
      setFeedback({
        type: 'error',
        message: 'Üst segment yükseltmesi için müşteri onayı zorunludur.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const dto: DeliverVehicleDto = {
        reservationId: selectedResForDeliver.id,
        vehicleId: deliverForm.vehicleId,
        mileageOut: Number(deliverForm.mileageOut),
        fuelLevelOut: Number(deliverForm.fuelLevelOut),
        isExceptionUpgrade: deliverForm.isExceptionUpgrade,
        customerApproved: deliverForm.customerApproved,
        notes: deliverForm.notes || undefined,
      };

      await api.handover.deliver(dto);
      setFeedback({
        type: 'success',
        message: 'Araç müşteriye başarıyla teslim edildi. Rezervasyon durumu Kirada (Teslim Edildi) yapıldı.',
      });
      setDeliverModalOpen(false);
      fetchOperationsData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Teslimat işlemi sırasında hata oluştu.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // İade Al Submit
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResForReturn) return;

    const currentVehicleKm = selectedResForReturn.vehicle?.mileage || 0;
    if (returnForm.mileageIn < currentVehicleKm) {
      setFeedback({
        type: 'error',
        message: `İade kilometresi teslim anındaki kilometreden (${currentVehicleKm} KM) küçük olamaz!`,
      });
      return;
    }

    if (returnForm.hasDamage && !returnForm.damageNotes.trim()) {
      setFeedback({
        type: 'error',
        message: 'Hasar tespit edildiyse hasar açıklaması girilmesi zorunludur.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const dto: ReturnVehicleDto = {
        reservationId: selectedResForReturn.id,
        mileageIn: Number(returnForm.mileageIn),
        fuelLevelIn: Number(returnForm.fuelLevelIn),
        hasDamage: returnForm.hasDamage,
        damageNotes: returnForm.damageNotes || undefined,
        notes: returnForm.notes || undefined,
      };

      await api.handover.return(dto);
      setFeedback({
        type: 'success',
        message: returnForm.hasDamage
          ? 'Araç iade alındı. Hasar tespit edildiği için araç otomatik olarak Hasarlı / Hizmet Dışı durumuna alındı.'
          : 'Araç başarıyla iade alındı ve rezervasyon tamamlandı.',
      });
      setReturnModalOpen(false);
      fetchOperationsData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'İade işlemi sırasında hata oluştu.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // NO_SHOW İşaretle
  const handleNoShow = async (reservationId: string) => {
    if (!confirm('Müşteri aracı teslim almaya gelmedi olarak işaretlensin mi? (Bu işlem geri alınamaz)')) {
      return;
    }

    try {
      await api.handover.markNoShow(reservationId);
      setFeedback({
        type: 'success',
        message: 'Rezervasyon Teslim Alınmadı (No-Show) olarak işaretlendi ve kapasite serbest bırakıldı.',
      });
      fetchOperationsData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'İşlem başarısız.';
      setFeedback({ type: 'error', message });
    }
  };

  // Filtreleme
  const filteredList = (activeTab === 'DELIVERIES' ? deliveries : returns).filter((item) => {
    const q = searchQuery.toLowerCase();
    const customerName = `${item.customer?.customerProfile?.firstName || ''} ${item.customer?.customerProfile?.lastName || ''}`.toLowerCase();
    const phone = item.customer?.phone || '';
    const plate = item.vehicle?.licensePlate?.toLowerCase() || '';
    const branch = item.branchName?.toLowerCase() || '';
    return customerName.includes(q) || phone.includes(q) || plate.includes(q) || branch.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Şube Teslim / İade Operasyonları</h1>
          <p className="text-sm text-slate-600 mt-1">
            Fiziksel araç anahtar teslimi, kilometre & yakıt tutanağı ve hasar kontrolü
          </p>
        </div>

        <button
          onClick={fetchOperationsData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-lg text-slate-700 text-sm font-medium shadow-2xs self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Geri Bildirim Toast */}
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

      {/* Sekmeler & Arama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex rounded-xl bg-white p-1.5 border border-[#CBD5E1] shadow-2xs">
          <button
            onClick={() => setActiveTab('DELIVERIES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'DELIVERIES'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Teslimat Bekleyenler</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'DELIVERIES' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {deliveries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('RETURNS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'RETURNS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>İade Bekleyenler</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'RETURNS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {returns.length}
            </span>
          </button>
        </div>

        {/* Hızlı Arama */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri, telefon, plaka ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Operasyon Tablosu */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
              <tr>
                <th className="px-5 py-4">Müşteri</th>
                <th className="px-5 py-4">Araç Grubu / Plaka</th>
                <th className="px-5 py-4">Şube</th>
                <th className="px-5 py-4">
                  {activeTab === 'DELIVERIES' ? 'Planlanan Alış' : 'Planlanan İade'}
                </th>
                <th className="px-5 py-4">Durum</th>
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
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    {searchQuery ? 'Arama kriterine uygun kayıt bulunamadı.' : 'İşlem bekleyen rezervasyon yok.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((res) => {
                  const badge = getStatusBadgeClass(res.state);
                  const customerName = res.customer?.customerProfile
                    ? `${res.customer.customerProfile.firstName} ${res.customer.customerProfile.lastName}`
                    : 'İsimsiz Müşteri';

                  return (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <div>{customerName}</div>
                        <div className="text-xs text-slate-400 font-normal">{res.customer?.phone}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {getSegmentLabel(res.priceSnapshot?.segmentName || '')} - {res.priceSnapshot?.bodyTypeName}
                        </div>
                        {res.vehicle ? (
                          <div className="inline-block mt-0.5 px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-xs font-bold">
                            {res.vehicle.licensePlate} ({res.vehicle.mileage} KM)
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Plaka Atanmadı</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-800">{res.branchName}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateTime(activeTab === 'DELIVERIES' ? res.startTime : res.endTime)}</span>
                        </div>
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
                        {activeTab === 'DELIVERIES' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openDeliverModal(res)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            >
                              Aracı Teslim Et
                            </button>
                            <button
                              onClick={() => handleNoShow(res.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Gelmeyen Müşteri (No-Show)"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openReturnModal(res)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            İade Al
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TESLİMAT MODALI */}
      {deliverModalOpen && selectedResForDeliver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between sticky top-0 bg-[#F8FAFC]">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Araç Teslim Tutanağı</h3>
                <p className="text-xs text-slate-500">Rezervasyon: {selectedResForDeliver.id.slice(0, 8)}...</p>
              </div>
              <button
                onClick={() => setDeliverModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeliverSubmit} className="p-6 space-y-4">
              {/* Müşteri & Araç Grubu Özeti */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Müşteri:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedResForDeliver.customer?.customerProfile
                      ? `${selectedResForDeliver.customer.customerProfile.firstName} ${selectedResForDeliver.customer.customerProfile.lastName}`
                      : selectedResForDeliver.customer?.phone}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Talep Edilen Grup:</span>
                  <span className="font-semibold text-slate-800">
                    {getSegmentLabel(selectedResForDeliver.priceSnapshot?.segmentName || '')} - {selectedResForDeliver.priceSnapshot?.bodyTypeName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Şube:</span>
                  <span className="font-semibold text-slate-800">{selectedResForDeliver.branchName}</span>
                </div>
              </div>

              {/* Araç Seçimi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Teslim Edilecek Fiziksel Araç (Şubedeki Müsaitler) *
                </label>
                {loadingVehicles ? (
                  <div className="text-xs text-slate-400 py-2">Uygun araçlar listeleniyor...</div>
                ) : eligibleVehicles.length === 0 ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                    Şubede tam eşleşen müsait araç kalmadı!
                    {isSuperAdmin && ' Üst segment istisnası ile araç atayabilirsiniz.'}
                  </div>
                ) : (
                  <select
                    value={deliverForm.vehicleId}
                    onChange={(e) => {
                      const vId = e.target.value;
                      const selected = eligibleVehicles.find((v) => v.id === vId);
                      setDeliverForm((prev) => ({
                        ...prev,
                        vehicleId: vId,
                        mileageOut: selected?.mileage || 0,
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {eligibleVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate} - {v.brandName} {v.modelName} ({v.mileage} KM)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Teslim Kilometresi & Yakıt */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Teslim Kilometresi (KM) *
                  </label>
                  <div className="relative">
                    <Gauge className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={0}
                      value={deliverForm.mileageOut}
                      onChange={(e) =>
                        setDeliverForm({ ...deliverForm, mileageOut: Number(e.target.value) })
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Yakıt Seviyesi (% 0-100) *
                  </label>
                  <div className="relative">
                    <Fuel className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={deliverForm.fuelLevelOut}
                      onChange={(e) =>
                        setDeliverForm({ ...deliverForm, fuelLevelOut: Number(e.target.value) })
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Üst Segment İstisnası (Yalnızca SUPER_ADMIN) */}
              {isSuperAdmin && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={deliverForm.isExceptionUpgrade}
                      onChange={(e) =>
                        setDeliverForm({ ...deliverForm, isExceptionUpgrade: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Stok Yetersizliği Nedeniyle Üst Segment İstisnası Uygula</span>
                  </label>

                  {deliverForm.isExceptionUpgrade && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900 pl-5">
                      <input
                        type="checkbox"
                        checked={deliverForm.customerApproved}
                        onChange={(e) =>
                          setDeliverForm({ ...deliverForm, customerApproved: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Müşterinin sözlü ve yazılı onayı alındı (Fiyat Farksız)</span>
                    </label>
                  )}
                </div>
              )}

              {/* Notlar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Teslimat Notları</label>
                <textarea
                  rows={2}
                  value={deliverForm.notes}
                  onChange={(e) => setDeliverForm({ ...deliverForm, notes: e.target.value })}
                  placeholder="Kozmetik durum, ek ekipman vb..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeliverModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || eligibleVehicles.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'İşleniyor...' : 'Teslimatı Onayla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İADE ALMA MODALI */}
      {returnModalOpen && selectedResForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#CBD5E1] flex items-center justify-between sticky top-0 bg-[#F8FAFC]">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Araç İade Alma Tutanağı</h3>
                <p className="text-xs text-slate-500">
                  {selectedResForReturn.vehicle?.licensePlate || 'Plaka'} - İade Kontrolü
                </p>
              </div>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              {/* Teslimat Bilgi Notu */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Müşteri:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedResForReturn.customer?.customerProfile
                      ? `${selectedResForReturn.customer.customerProfile.firstName} ${selectedResForReturn.customer.customerProfile.lastName}`
                      : selectedResForReturn.customer?.phone}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Teslim Anındaki KM:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedResForReturn.vehicle?.mileage || 0} KM
                  </span>
                </div>
              </div>

              {/* İade Kilometresi ve Yakıt */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    İade Kilometresi (KM) *
                  </label>
                  <div className="relative">
                    <Gauge className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={selectedResForReturn.vehicle?.mileage || 0}
                      value={returnForm.mileageIn}
                      onChange={(e) =>
                        setReturnForm({ ...returnForm, mileageIn: Number(e.target.value) })
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    İade Yakıt Seviyesi (% 0-100) *
                  </label>
                  <div className="relative">
                    <Fuel className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={returnForm.fuelLevelIn}
                      onChange={(e) =>
                        setReturnForm({ ...returnForm, fuelLevelIn: Number(e.target.value) })
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Hasar Tespiti Switch */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-slate-900 block">Araçta Hasar Var mı?</label>
                    <span className="text-xs text-slate-500">
                      Çizik, göçük, kaza veya iç deformasyon tespiti
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={returnForm.hasDamage}
                    onChange={(e) => setReturnForm({ ...returnForm, hasDamage: e.target.checked })}
                    className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500"
                  />
                </div>

                {returnForm.hasDamage && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-rose-800 mb-1">
                      Hasar Açıklaması & Tespit Notu *
                    </label>
                    <textarea
                      rows={2}
                      value={returnForm.damageNotes}
                      onChange={(e) => setReturnForm({ ...returnForm, damageNotes: e.target.value })}
                      placeholder="Örn: Sağ ön çamurlukta derin çizik..."
                      required
                      className="w-full px-3 py-2 bg-rose-50/50 border border-rose-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                    <p className="text-[11px] text-rose-600 mt-1">
                      ⚠️ Hasar işaretlendiğinde araç otomatik olarak <strong>Hasarlı / Hizmet Dışı</strong> durumuna geçirilecek ve servise yönlendirilecektir.
                    </p>
                  </div>
                )}
              </div>

              {/* Genel İade Notları */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Genel Notlar</label>
                <textarea
                  rows={2}
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Ek açıklamalar..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'İşleniyor...' : 'İadeyi Tamamla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
