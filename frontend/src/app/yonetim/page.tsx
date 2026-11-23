'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { DashboardSummary, RevenueReport } from '@/types/api';
import { formatCurrency, formatDateShort } from '@/lib/statusLabels';
import {
  Car,
  KeyRound,
  AlertTriangle,
  CalendarCheck2,
  XCircle,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export default function YonetimDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7' | '30' | 'all'>('30');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await api.reports.getDashboardSummary();
      setDashboard(summary);

      // Tarih filtresine göre gelir raporunu çek
      let startDate: string | undefined = undefined;
      const now = new Date();
      if (timeFilter === '7') {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        startDate = d.toISOString();
      } else if (timeFilter === '30') {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        startDate = d.toISOString();
      }

      const rev = await api.reports.getRevenueReport(startDate ? { startDate } : undefined);
      setRevenue(rev);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Veriler yüklenirken bir hata oluştu.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filo Pasta Grafiği Verisi
  const fleetPieData = dashboard
    ? [
        {
          name: 'Müsait Araçlar',
          value: dashboard.vehiclesByState['AVAILABLE'] || 0,
          color: '#10B981', // Emerald
        },
        {
          name: 'Kiradaki Araçlar',
          value: dashboard.vehiclesByState['RENTED'] || 0,
          color: '#2563EB', // Blue
        },
        {
          name: 'Bakımda Araçlar',
          value: dashboard.vehiclesByState['MAINTENANCE'] || 0,
          color: '#F59E0B', // Amber
        },
        {
          name: 'Hasarlı / Servis Dışı',
          value: dashboard.vehiclesByState['DAMAGED_OUT_OF_SERVICE'] || 0,
          color: '#EF4444', // Rose
        },
        {
          name: 'Pasif Araçlar',
          value: dashboard.vehiclesByState['INACTIVE'] || 0,
          color: '#64748B', // Slate
        },
      ].filter((item) => item.value > 0)
    : [];

  // Gelir Grafiği Verisi
  const chartRevenueData = revenue?.dailyBreakdown?.map((item) => ({
    tarih: formatDateShort(item.date),
    tahsilat: item.chargedAmount,
    iade: item.refundedAmount,
    net: item.netAmount,
    rezervasyon: item.reservationCount,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Başlık ve Aksiyon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Yönetim ve Operasyon Özeti</h1>
          <p className="text-sm text-slate-600 mt-1">
            Filo doluluğu, anlık kiralama performansı ve şube gelir metrikleri
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg bg-white p-1 border border-[#CBD5E1] shadow-2xs">
            <button
              onClick={() => setTimeFilter('7')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                timeFilter === '7'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Son 7 Gün
            </button>
            <button
              onClick={() => setTimeFilter('30')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                timeFilter === '30'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Son 30 Gün
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                timeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tüm Zamanlar
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-lg text-slate-700 transition-colors shadow-2xs"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hata Uyarısı */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* 6 Responsive KPI Kartı */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Kart 1: Müsait Araçlar */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#CBD5E1] shadow-2xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Müsait Araç</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : dashboard?.vehiclesByState['AVAILABLE'] || 0}
          </div>
          <span className="text-xs text-emerald-600 font-medium">Hemen kiralanabilir</span>
        </div>

        {/* Kart 2: Kiradaki Araçlar */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#CBD5E1] shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kirada</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : dashboard?.vehiclesByState['RENTED'] || 0}
          </div>
          <span className="text-xs text-blue-600 font-medium">Müşteride aktif</span>
        </div>

        {/* Kart 3: Bakımda / Hasarlı */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#CBD5E1] shadow-2xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bakım / Hasar</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading
              ? '...'
              : (dashboard?.vehiclesByState['MAINTENANCE'] || 0) +
                (dashboard?.vehiclesByState['DAMAGED_OUT_OF_SERVICE'] || 0)}
          </div>
          <span className="text-xs text-amber-600 font-medium">Hizmet dışı</span>
        </div>

        {/* Kart 4: Toplam Rezervasyon */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#CBD5E1] shadow-2xs hover:border-slate-400 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Rez.</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : dashboard?.totalReservations || 0}
          </div>
          <span className="text-xs text-slate-500 font-medium">Sistem geneli</span>
        </div>

        {/* Kart 5: İptal Sayısı */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#CBD5E1] shadow-2xs hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">İptal Edilen</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : dashboard?.reservationsByState['CANCELLED'] || 0}
          </div>
          <span className="text-xs text-rose-600 font-medium">Tam iade yapıldı</span>
        </div>

        {/* Kart 6: Net Gelir */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#CBD5E1] shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Gelir</span>
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-700 truncate">
            {isLoading ? '...' : formatCurrency(dashboard?.netRevenue || 0)}
          </div>
          <span className="text-xs text-slate-500 font-medium">Tahsilat - İadeler</span>
        </div>
      </div>

      {/* Grafikler Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol 2 Kolon: Gelir ve Finansal Trend */}
        <div className="lg:col-span-2 bg-[#F8FAFC] p-6 rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Finansal Akış & Gelir Eğilimi</h2>
              <p className="text-xs text-slate-500">Günlük tahsilat, tam iadeler ve net kiralama geliri</p>
            </div>
            {revenue && (
              <div className="text-right">
                <span className="text-xs text-slate-500">Dönem Net Geliri:</span>
                <p className="text-base font-bold text-emerald-600">{formatCurrency(revenue.netRevenue)}</p>
              </div>
            )}
          </div>

          <div className="w-full h-72">
            {chartRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart data={chartRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="refundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="tarih" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} tickFormatter={(val) => `₺${val}`} />
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(Number(value || 0)), '']}
                    labelStyle={{ fontWeight: 'bold', color: '#0F172A' }}
                    contentStyle={{
                      backgroundColor: '#F8FAFC',
                      borderColor: '#CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    name="Net Gelir"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#netGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="iade"
                    name="İade Edilen"
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#refundGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <CalendarCheck2 className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-sm">Seçilen dönemde henüz kiralama işlemi bulunmuyor</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
              <span>Net Gelir (Tahsilat - İadeler)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
              <span>Tam İadeler</span>
            </div>
          </div>
        </div>

        {/* Sağ 1 Kolon: Filo Durum Dağılımı */}
        <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-[#CBD5E1] shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Filo Durum Dağılımı</h2>
            <p className="text-xs text-slate-500 mb-4">
              Toplam {dashboard?.totalVehicles || 0} kayıtlı araç
            </p>
          </div>

          <div className="w-full h-64 flex items-center justify-center">
            {fleetPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={fleetPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {fleetPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [`${val} Araç`, 'Adet']}
                    contentStyle={{
                      backgroundColor: '#F8FAFC',
                      borderColor: '#CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={10}
                    formatter={(value) => <span className="text-xs text-slate-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Car className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-sm">Henüz filoda araç bulunmuyor</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Toplam Filo Kapasitesi</span>
              <span className="font-bold text-slate-900">{dashboard?.totalVehicles || 0} Adet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
