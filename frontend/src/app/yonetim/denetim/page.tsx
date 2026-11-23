'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { AuditLogItem, PaginationMeta, AuditAction } from '@/types/api';
import { formatDateTime, getAuditActionLabel, getRoleLabel } from '@/lib/statusLabels';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  FileCode,
} from 'lucide-react';

export default function YonetimDenetimPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Detay Modalı
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.admin.auditLogs.list({
        page,
        limit: 15,
        action: (actionFilter as AuditAction) || undefined,
      });
      setLogs(res.data || []);
      setMeta(res.meta || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sistem Denetim Günlüğü</h1>
          <p className="text-sm text-slate-600 mt-1">
            KVKK, rezervasyon, araç durumu ve kullanıcı yetki değişikliklerinin değişmez sistem kayıtları
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-xl text-slate-700 text-sm font-medium shadow-2xs self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1] self-start w-fit">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs font-medium text-slate-800 bg-transparent focus:outline-hidden"
        >
          <option value="">Tüm Denetim Eylemleri</option>
          <option value="USER_CREATED">Kullanıcı Oluşturuldu</option>
          <option value="USER_UPDATED">Kullanıcı Güncellendi</option>
          <option value="USER_DELETED">Kullanıcı Silindi</option>
          <option value="VEHICLE_CREATED">Yeni Araç Eklendi</option>
          <option value="VEHICLE_UPDATED">Araç Bilgisi Güncellendi</option>
          <option value="VEHICLE_DELETED">Araç Pasife Alındı</option>
          <option value="RESERVATION_CREATED">Rezervasyon Oluşturuldu</option>
          <option value="RESERVATION_UPDATED">Rezervasyon Güncellendi</option>
          <option value="RESERVATION_CANCELLED">Rezervasyon İptal Edildi</option>
          <option value="HANDOVER_COMPLETED">Araç Teslim Edildi</option>
          <option value="RETURN_COMPLETED">Araç İade Alındı</option>
          <option value="VEHICLE_DAMAGED_ON_RETURN">İadede Hasar Kaydedildi</option>
          <option value="PROFILE_CORRECTION_REQUESTED">Kimlik Düzeltme Talep Edildi</option>
          <option value="PROFILE_CORRECTION_REVIEWED">Kimlik Düzeltme İncelendi</option>
        </select>
      </div>

      {/* Log Tablosu */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/80 text-xs font-semibold uppercase text-slate-500 border-b border-[#CBD5E1]">
              <tr>
                <th className="px-5 py-4">Denetim Eylemi</th>
                <th className="px-5 py-4">İşlemi Yapan</th>
                <th className="px-5 py-4">İlgili Kayıt / Varlık</th>
                <th className="px-5 py-4">IP Adresi</th>
                <th className="px-5 py-4">İşlem Tarihi</th>
                <th className="px-5 py-4 text-right">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CBD5E1]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Denetim kayıtları yükleniyor...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Kayıtlı denetim logu bulunamadı.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs bg-slate-200/70 border border-slate-300 text-slate-800">
                        {getAuditActionLabel(log.action)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      {log.performedBy ? (
                        <div>
                          <div className="font-semibold text-slate-800">{log.performedBy.email}</div>
                          <div className="text-slate-500 font-medium text-[11px]">{getRoleLabel(log.performedBy.role)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sistem / Otomatik</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs font-mono text-slate-700">
                      <div className="flex flex-col gap-1 items-start">
                        {log.reservationId && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                            Rez: #{log.reservationId.slice(0, 8)}
                          </span>
                        )}
                        {log.vehicleId && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]">
                            Araç: #{log.vehicleId.slice(0, 8)}
                          </span>
                        )}
                        {log.targetUserId && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[11px]">
                            Kullanıcı: #{log.targetUserId.slice(0, 8)}
                          </span>
                        )}
                        {!log.reservationId && !log.vehicleId && !log.targetUserId && (
                          <span className="text-slate-400 font-sans text-xs">-</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {log.ipAddress || '127.0.0.1'}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {formatDateTime(log.createdAt)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Log Verisini Gör"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
              Toplam {meta.total} denetim kaydı (Sayfa {meta.page} / {meta.totalPages})
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

      {/* DETAY JSON MODALI */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#0F172A] text-slate-200 rounded-2xl border border-slate-800 shadow-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0F172A]">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  Denetim Detayı: {getAuditActionLabel(selectedLog.action)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 block">Kayıt ID:</span>
                  <span className="text-slate-300">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tarih / Saat:</span>
                  <span className="text-slate-300">{formatDateTime(selectedLog.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">İşlemi Yapan ID:</span>
                  <span className="text-slate-300">{selectedLog.performedByUserId || 'SYSTEM'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">IP Adresi:</span>
                  <span className="text-slate-300">{selectedLog.ipAddress || '-'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  İşlem Verisi (Payload & Snapshot)
                </label>
                <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800 max-h-64">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
