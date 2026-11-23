/**
 * EAraç Kiralama - %100 Doğal Türkçe Etiket Eşleyicileri & Yardımcı Fonksiyonlar
 * Hiçbir İngilizce backend enum değeri kullanıcı arayüzüne sızmaz.
 */

import { VehicleState, AuditAction, ReservationState } from '@/types/api';

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Ödeme Bekliyor',
  CONFIRMED: 'Onaylandı (Teslimat Bekliyor)',
  ACTIVE: 'Kirada (Teslim Edildi)',
  COMPLETED: 'Tamamlandı (İade Alındı)',
  CANCELLED: 'İptal Edildi',
  EXPIRED: 'Süresi Doldu',
  PAYMENT_FAILED: 'Ödeme Başarısız',
  NO_SHOW: 'Teslim Alınmadı (No-Show)',
};

export const VEHICLE_STATE_LABELS: Record<VehicleState, string> = {
  AVAILABLE: 'Müsait',
  RENTED: 'Kirada',
  MAINTENANCE: 'Bakımda / Serviste',
  DAMAGED_OUT_OF_SERVICE: 'Hasarlı / Hizmet Dışı',
  INACTIVE: 'Pasif (Kullanım Dışı)',
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_CREATED: 'Kullanıcı Oluşturuldu',
  USER_UPDATED: 'Kullanıcı Güncellendi',
  USER_DELETED: 'Kullanıcı Silindi',
  VEHICLE_CREATED: 'Yeni Araç Eklendi',
  VEHICLE_UPDATED: 'Araç Bilgisi Güncellendi',
  VEHICLE_DELETED: 'Araç Pasife Alındı',
  RESERVATION_CREATED: 'Rezervasyon Oluşturuldu',
  RESERVATION_UPDATED: 'Rezervasyon Güncellendi',
  RESERVATION_CANCELLED: 'Rezervasyon İptal Edildi',
  RESERVATION_NO_SHOW: 'Teslim Alınmadı İşaretlendi',
  VEHICLE_DAMAGED_ON_RETURN: 'İadede Hasar Kaydedildi',
  HANDOVER_COMPLETED: 'Araç Müşteriye Teslim Edildi',
  RETURN_COMPLETED: 'Araç İade Alındı',
  USER_ACCOUNT_CLOSED: 'Müşteri Hesabı Kapatıldı',
  VEHICLE_EXCEPTION_ASSIGNED: 'Üst Segment İstisnası Tanımlandı',
  PROFILE_CORRECTION_REQUESTED: 'Kimlik Düzeltme Talep Edildi',
  PROFILE_CORRECTION_REVIEWED: 'Kimlik Düzeltme İncelendi',
};

export const SEGMENT_LABELS: Record<string, string> = {
  ECONOMIC: 'Ekonomik',
  MEDIUM: 'Orta',
  PREMIUM: 'Premium',
  Economic: 'Ekonomik',
  Medium: 'Orta',
  Premium: 'Premium',
  economic: 'Ekonomik',
  medium: 'Orta',
  premium: 'Premium',
};

export const SEGMENT_REQUIREMENTS: Record<string, { minAge: number; minLicenseYears: number }> = {
  ECONOMIC: { minAge: 21, minLicenseYears: 2 },
  MEDIUM: { minAge: 23, minLicenseYears: 3 },
  PREMIUM: { minAge: 25, minLicenseYears: 5 },
};

export const FUEL_TYPE_LABELS: Record<string, string> = {
  GASOLINE: 'Benzin',
  DIESEL: 'Dizel',
  HYBRID: 'Hibrit',
  ELECTRIC: 'Elektrikli',
  LPG: 'LPG / Otogaz',
  Benzin: 'Benzin',
  Dizel: 'Dizel',
  Hibrit: 'Hibrit',
  Elektrik: 'Elektrikli',
  benzin: 'Benzin',
  dizel: 'Dizel',
  hibrit: 'Hibrit',
  elektrik: 'Elektrikli',
};

export const TRANSMISSION_LABELS: Record<string, string> = {
  MANUAL: 'Manuel',
  AUTOMATIC: 'Otomatik',
  SEMI_AUTOMATIC: 'Yarı Otomatik',
  Manuel: 'Manuel',
  Otomatik: 'Otomatik',
  manuel: 'Manuel',
  otomatik: 'Otomatik',
};

export const BODY_TYPE_LABELS: Record<string, string> = {
  SEDAN: 'Sedan',
  HATCHBACK: 'Hatchback',
  SUV: 'SUV',
  STATION_WAGON: 'Station Wagon',
  COUPE: 'Coupe',
  Sedan: 'Sedan',
  Hatchback: 'Hatchback',
  'Station Wagon': 'Station Wagon',
  Coupe: 'Coupe',
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  suv: 'SUV',
  'station wagon': 'Station Wagon',
};

export const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Müşteri',
  STAFF: 'Şube Personeli',
  SUPER_ADMIN: 'Sistem Yöneticisi',
};

export const CHANGE_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
};

export function getReservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABELS[status] || status;
}

export function getVehicleStateLabel(state: VehicleState | string): string {
  return VEHICLE_STATE_LABELS[state as VehicleState] || state;
}

export function getAuditActionLabel(action: AuditAction | string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] || action;
}

export function getSegmentLabel(segment?: string | null): string {
  if (!segment) return '-';
  return SEGMENT_LABELS[segment] || SEGMENT_LABELS[segment.toUpperCase()] || segment;
}

export function getFuelTypeLabel(fuel?: string | null): string {
  if (!fuel) return '-';
  return FUEL_TYPE_LABELS[fuel] || FUEL_TYPE_LABELS[fuel.toUpperCase()] || fuel;
}

export function getTransmissionLabel(trans?: string | null): string {
  if (!trans) return '-';
  return TRANSMISSION_LABELS[trans] || TRANSMISSION_LABELS[trans.toUpperCase()] || trans;
}

export function getBodyTypeLabel(body?: string | null): string {
  if (!body) return '-';
  return BODY_TYPE_LABELS[body] || BODY_TYPE_LABELS[body.toUpperCase().replace(/\s+/g, '_')] || body;
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

/**
 * Rezervasyon durum rozet sınıfları
 */
export function getStatusBadgeClass(status: string): { bg: string; text: string; border: string; dot: string } {
  switch (status) {
    case 'CONFIRMED':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'ACTIVE':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'PENDING_PAYMENT':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        dot: 'bg-slate-500',
      };
    case 'CANCELLED':
    case 'EXPIRED':
    case 'PAYMENT_FAILED':
    case 'NO_SHOW':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

/**
 * Araç durumu rozet sınıfları
 */
export function getVehicleStateBadgeClass(state: VehicleState | string): { bg: string; text: string; border: string; dot: string } {
  switch (state) {
    case 'AVAILABLE':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'RENTED':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'MAINTENANCE':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'DAMAGED_OUT_OF_SERVICE':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };
    case 'INACTIVE':
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

/**
 * Para formatlama: ₺1.250,00
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  if (isNaN(num)) return '₺0,00';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Uzun Tarih Formatı: 15 Aralık 2026
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Tarih ve Saat: 15 Aralık 2026, 14:30
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Kısa Tarih: 15.12.2026
 */
export function formatDateShort(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Maskelenmiş telefon: +90 555 *** ** 67
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length < 10) return phone;
  return clean.slice(0, 6) + ' *** ** ' + clean.slice(-2);
}
