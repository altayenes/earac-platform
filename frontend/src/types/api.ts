/**
 * EAraç Kiralama - API Tipleri & DTO Sözleşmeleri
 * backend/openapi.json ile tam uyumludur.
 */

export type UserRole = 'CUSTOMER' | 'STAFF' | 'SUPER_ADMIN';

export type ReservationState =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PAYMENT_FAILED'
  | 'NO_SHOW';

export type VehicleState =
  | 'AVAILABLE'
  | 'RENTED'
  | 'MAINTENANCE'
  | 'DAMAGED_OUT_OF_SERVICE'
  | 'INACTIVE';

export type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'VEHICLE_CREATED'
  | 'VEHICLE_UPDATED'
  | 'VEHICLE_DELETED'
  | 'RESERVATION_CREATED'
  | 'RESERVATION_UPDATED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_NO_SHOW'
  | 'VEHICLE_DAMAGED_ON_RETURN'
  | 'HANDOVER_COMPLETED'
  | 'RETURN_COMPLETED'
  | 'USER_ACCOUNT_CLOSED'
  | 'VEHICLE_EXCEPTION_ASSIGNED'
  | 'PROFILE_CORRECTION_REQUESTED'
  | 'PROFILE_CORRECTION_REVIEWED';

export interface CustomerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  licenseDate: string; // YYYY-MM-DD
  maskedNationalId: string; // 123*****901
  calculatedAge: number;
  calculatedLicenseYears: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffPermission {
  id: string;
  userId: string;
  branchId?: string | null;
  canManageVehicles: boolean;
  canManageReservations: boolean;
  canManagePricing: boolean;
  canManageStaff?: boolean;
  canManageUsers?: boolean;
  canManageBranches?: boolean;
  canViewReports?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  customerProfile?: CustomerProfile | null;
  staffPermission?: StaffPermission | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  openingTime: string; // "08:00"
  closingTime: string; // "22:00"
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchDto {
  name: string;
  address: string;
  openingTime: string;
  closingTime: string;
}

export interface UpdateBranchDto {
  address?: string;
  openingTime?: string;
  closingTime?: string;
  isActive?: boolean;
}

export interface AvailableGroup {
  segmentId: string;
  segmentName: string;
  minAge: number;
  minLicenseYears: number;
  bodyTypeId: string;
  bodyTypeName: string;
  fuelTypeId: string;
  fuelTypeName: string;
  transmissionTypeId: string;
  transmissionTypeName: string;
  dailyPrice: number;
  totalDays: number;
  totalAmount: number;
  availableCount: number;
}

export interface ReservationPriceSnapshot {
  id?: string;
  reservationId?: string;
  dailyPrice: number;
  totalDays: number;
  totalAmount: number;
  taxAmount?: number;
  currency?: string;
  segmentId?: string;
  segmentName?: string;
  bodyTypeId?: string;
  bodyTypeName?: string;
  fuelTypeId?: string;
  fuelTypeName?: string;
  transmissionTypeId?: string;
  transmissionTypeName?: string;
  createdAt?: string;
}

export interface Reservation {
  id: string;
  customerId: string;
  customer?: {
    id: string;
    phone: string;
    email: string;
    customerProfile?: {
      firstName: string;
      lastName: string;
      maskedNationalId?: string;
    } | null;
  };
  branchId: string;
  branchName: string;
  vehicleId?: string | null;
  vehicle?: AdminVehicle | null;
  startTime: string; // ISO
  endTime: string; // ISO
  state: ReservationState;
  expiresAt?: string | null; // ISO (15 min payment window)
  priceSnapshot?: ReservationPriceSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationChangeRequest {
  id: string;
  reservationId: string;
  customerId: string;
  requestedPickupAt?: string | null;
  requestedReturnAt?: string | null;
  requestedSegmentId?: string | null;
  requestedBodyTypeId?: string | null;
  requestedFuelTypeId?: string | null;
  requestedTransmissionTypeId?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  priceDifference?: number | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  reservation?: Reservation;
}

export interface ProcessPaymentDto {
  reservationId: string;
  idempotencyKey: string;
  cardHolderName?: string;
  cardNumber?: string;
  expireMonth?: string;
  expireYear?: string;
  cvv?: string;
  simulateFailure?: boolean;
}

export interface PaymentResponse {
  id: string;
  reservationId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
  transactionId?: string;
  createdAt: string;
}

export interface CreateReservationDto {
  branchId: string;
  segmentId: string;
  bodyTypeId: string;
  fuelTypeId: string;
  transmissionId: string;
  plannedPickupAt: string;
  plannedReturnAt: string;
}

export interface CreateCustomerProfileDto {
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  licenseDate: string; // YYYY-MM-DD
  nationalId: string; // 11 haneli TC
}

export interface CreateProfileCorrectionRequestDto {
  requestedFirstName?: string;
  requestedLastName?: string;
  requestedBirthDate?: string;
  requestedLicenseDate?: string;
  requestedNationalId?: string;
  reason: string;
}

export interface ProfileCorrectionRequestItem {
  id: string;
  userId: string;
  user?: {
    id: string;
    phone: string;
    email: string;
    customerProfile?: CustomerProfile | null;
  };
  requestedFirstName?: string | null;
  requestedLastName?: string | null;
  requestedBirthDate?: string | null;
  requestedLicenseDate?: string | null;
  requestedNationalId?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChangeRequestDto {
  requestedPickupAt?: string;
  requestedReturnAt?: string;
  requestedSegmentId?: string;
  requestedBodyTypeId?: string;
  requestedFuelTypeId?: string;
  requestedTransmissionTypeId?: string;
}

export interface CancelReservationDto {
  reason: string;
}

export interface SendSmsDto {
  phone: string;
  purpose: 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET' | 'REGISTRATION' | 'PHONE_UPDATE';
}

export interface VerifySmsDto {
  phone: string;
  code: string;
  purpose: 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET' | 'REGISTRATION' | 'PHONE_UPDATE';
}

export interface RegisterDto {
  phone: string;
  password: string;
  email: string;
  smsCode?: string;
  smsVerificationCode?: string;
}

export interface LoginDto {
  phone: string;
  password: string;
}

export interface ResetPasswordDto {
  phone: string;
  smsCode?: string;
  smsVerificationCode?: string;
  newPassword: string;
}

// ──────────────────────────────────────────────
// YÖNETİM & OPERASYON TİPLERİ
// ──────────────────────────────────────────────

export interface AdminVehicle {
  id: string;
  vin: string;
  licensePlate: string;
  brandName: string;
  modelName: string;
  segmentName: string;
  bodyTypeName: string;
  fuelTypeName: string;
  transmissionTypeName: string;
  branchId: string;
  branchName: string;
  state: VehicleState;
  year: number;
  mileage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleDto {
  vin: string;
  licensePlate: string;
  modelId: string;
  segmentId: string;
  bodyTypeId: string;
  fuelTypeId: string;
  transmissionId: string;
  branchId: string;
  year: number;
  mileage?: number;
}

export interface UpdateVehicleDto {
  mileage?: number;
  branchId?: string;
  isActive?: boolean;
}

export interface UpdateVehicleStateDto {
  state: VehicleState;
  reason?: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
  isActive: boolean;
  brandId?: string;
}

export interface ReferenceCatalog {
  segments: ReferenceItem[];
  bodyTypes: ReferenceItem[];
  fuelTypes: ReferenceItem[];
  transmissionTypes: ReferenceItem[];
  brands: ReferenceItem[];
  models: ReferenceItem[];
}

export interface PriceMatrixItem {
  id: string;
  segmentId: string;
  segmentName: string;
  minAge: number;
  minLicenseYears: number;
  bodyTypeId: string;
  bodyTypeName: string;
  dailyPrice: number;
  isActive: boolean;
}

export interface UpdateDailyPriceDto {
  dailyPrice: number;
}

export interface DashboardSummary {
  totalReservations: number;
  reservationsByState: Record<string, number>;
  totalVehicles: number;
  vehiclesByState: Record<string, number>;
  totalCharged: number;
  totalRefunded: number;
  netRevenue: number;
}

export interface DailyRevenueItem {
  date: string;
  reservationCount: number;
  chargedAmount: number;
  refundedAmount: number;
  netAmount: number;
}

export interface RevenueReport {
  startDate?: string;
  endDate?: string;
  totalReservations: number;
  totalCharged: number;
  totalRefunded: number;
  netRevenue: number;
  dailyBreakdown: DailyRevenueItem[];
}

export interface DeliverVehicleDto {
  reservationId: string;
  vehicleId: string;
  mileageOut: number;
  fuelLevelOut: number;
  actualPickupAt?: string;
  isExceptionUpgrade?: boolean;
  customerApproved?: boolean;
  notes?: string;
}

export interface ReturnVehicleDto {
  reservationId: string;
  mileageIn: number;
  fuelLevelIn: number;
  hasDamage: boolean;
  damageNotes?: string;
  actualReturnAt?: string;
  notes?: string;
}

export interface HandoverRecord {
  id: string;
  reservationId: string;
  vehicleId: string;
  mileageOut: number;
  fuelLevelOut: number;
  isExceptionUpgrade: boolean;
  customerApproved: boolean;
  actualPickupAt: string;
  notes?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

export interface ReturnRecord {
  id: string;
  reservationId: string;
  vehicleId: string;
  mileageIn: number;
  fuelLevelIn: number;
  hasDamage: boolean;
  damageNotes?: string | null;
  isLateReturn: boolean;
  lateMinutes: number;
  actualReturnAt: string;
  notes?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CreateStaffDto {
  phone: string;
  email: string;
  password: string;
  canManageVehicles?: boolean;
  canManageReservations?: boolean;
  canManageUsers?: boolean;
  canManageBranches?: boolean;
  canManagePricing?: boolean;
}

export interface UpdateStaffPermissionsDto {
  canManageVehicles?: boolean;
  canManageReservations?: boolean;
  canManageUsers?: boolean;
  canManageBranches?: boolean;
  canManagePricing?: boolean;
}

export interface AuditLogItem {
  id: string;
  action: AuditAction;
  performedByUserId?: string | null;
  performedBy?: {
    id: string;
    phone: string;
    email: string;
    role: UserRole;
  } | null;
  targetUserId?: string | null;
  reservationId?: string | null;
  vehicleId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}
