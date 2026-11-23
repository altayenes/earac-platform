/**
 * EAraç Kiralama - Tip Güvenli API İstemcisi
 * HttpOnly Refresh Cookie desteği (credentials: 'include') ve otomatik 401 Token Refresh mekanizması içerir.
 */

import {
  AdminVehicle,
  AuditAction,
  AuditLogItem,
  AuthResponse,
  AvailableGroup,
  Branch,
  CancelReservationDto,
  CreateBranchDto,
  CreateChangeRequestDto,
  CreateCustomerProfileDto,
  CreateProfileCorrectionRequestDto,
  CreateReservationDto,
  CreateStaffDto,
  CreateVehicleDto,
  DashboardSummary,
  DeliverVehicleDto,
  HandoverRecord,
  LoginDto,
  PaginatedResponse,
  PaymentResponse,
  PriceMatrixItem,
  ProcessPaymentDto,
  ProfileCorrectionRequestItem,
  ReferenceCatalog,
  ReferenceItem,
  RegisterDto,
  Reservation,
  ReservationChangeRequest,
  ResetPasswordDto,
  ReturnRecord,
  ReturnVehicleDto,
  RevenueReport,
  SendSmsDto,
  UpdateBranchDto,
  UpdateDailyPriceDto,
  UpdateStaffPermissionsDto,
  UpdateVehicleDto,
  UpdateVehicleStateDto,
  User,
  UserRole,
  VehicleState,
  VerifySmsDto,
} from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string | null) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('access_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
    return this.token;
  }

  private onRefreshed(token: string | null) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string | null) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async tryRefreshToken(): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        this.setToken(null);
        return null;
      }

      const data = await response.json();
      const newToken = data.accessToken || data.access_token;
      if (newToken) {
        this.setToken(newToken);
        return newToken;
      }
      return null;
    } catch {
      this.setToken(null);
      return null;
    }
  }

  public async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // HttpOnly cookie için şart
    };

    let response = await fetch(url, config);

    // 401 Unauthorized durumunda tek seferlik token yenileme denemesi
    if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/refresh')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        const newToken = await this.tryRefreshToken();
        this.isRefreshing = false;
        this.onRefreshed(newToken);

        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, { ...config, headers });
        }
      } else {
        // Zaten bir refresh işlemi devam ediyor, bekle ve yeni token ile tekrar dene
        const retryToken = await new Promise<string | null>((resolve) => {
          this.addRefreshSubscriber((t) => resolve(t));
        });

        if (retryToken) {
          headers['Authorization'] = `Bearer ${retryToken}`;
          response = await fetch(url, { ...config, headers });
        }
      }
    }

    if (!response.ok) {
      let errorMessage = 'Bir hata oluştu.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || response.statusText;
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage.join(', ');
        }
      } catch {
        errorMessage = `İstek başarısız oldu (${response.status})`;
      }
      throw new Error(errorMessage);
    }

    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ──────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────
  public auth = {
    sendSms: (dto: SendSmsDto) => {
      const normalizedPurpose = (dto.purpose === 'REGISTRATION' ? 'REGISTER' : dto.purpose) as 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';
      return this.request<{ success: boolean; message?: string }>('/api/auth/send-sms', {
        method: 'POST',
        body: JSON.stringify({ ...dto, purpose: normalizedPurpose }),
      });
    },

    verifySms: (dto: VerifySmsDto) => {
      const normalizedPurpose = (dto.purpose === 'REGISTRATION' ? 'REGISTER' : dto.purpose) as 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';
      return this.request<{ valid: boolean; message?: string }>('/api/auth/verify-sms', {
        method: 'POST',
        body: JSON.stringify({ ...dto, purpose: normalizedPurpose }),
      });
    },

    register: async (dto: RegisterDto): Promise<AuthResponse> => {
      const payload = {
        phone: dto.phone,
        email: dto.email,
        password: dto.password,
        smsCode: dto.smsCode || dto.smsVerificationCode,
      };
      const res = await this.request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.accessToken) {
        this.setToken(res.accessToken);
      }
      return res;
    },

    login: async (dto: LoginDto): Promise<AuthResponse> => {
      const res = await this.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      if (res.accessToken) {
        this.setToken(res.accessToken);
      }
      return res;
    },

    logout: async () => {
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } finally {
        this.setToken(null);
      }
    },

    getMe: () => this.request<User>('/api/auth/me', { method: 'GET' }),

    resetPassword: (dto: ResetPasswordDto) => {
      const payload = {
        phone: dto.phone,
        newPassword: dto.newPassword,
        smsCode: dto.smsCode || dto.smsVerificationCode,
      };
      return this.request<{ success: boolean; message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  };

  // ──────────────────────────────────────────────
  // USERS / KYC
  // ──────────────────────────────────────────────
  public users = {
    getMe: () => this.request<User>('/api/users/me', { method: 'GET' }),

    createProfile: (dto: CreateCustomerProfileDto) =>
      this.request<User>('/api/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify(dto),
      }),

    updateProfile: (data: Partial<CreateCustomerProfileDto>) =>
      this.request<User>('/api/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    changePhone: (dto: { newPhone: string; smsVerificationCode: string }) =>
      this.request<{ success: boolean; message: string }>('/api/users/me/change-phone', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    verifyEmail: (dto: { email: string; token?: string }) =>
      this.request<{ success: boolean; message: string }>('/api/users/me/verify-email', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    createCorrectionRequest: (dto: CreateProfileCorrectionRequestDto) =>
      this.request<{ success: boolean; message: string }>('/api/users/me/profile-correction-request', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    closeAccount: (reason: string) =>
      this.request<{ success: boolean; message: string }>('/api/users/me/close-account', {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    list: (params?: { role?: UserRole; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.role) q.set('role', params.role);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return this.request<User[]>(`/api/users?${q.toString()}`, { method: 'GET' });
    },
  };

  // ──────────────────────────────────────────────
  // ŞUBELER
  // ──────────────────────────────────────────────
  public branches = {
    getAll: (all: boolean = false) =>
      this.request<Branch[]>(`/api/branches${all ? '?all=true' : ''}`, { method: 'GET' }),

    getById: (id: string) =>
      this.request<Branch>(`/api/branches/${id}`, { method: 'GET' }),

    create: (dto: CreateBranchDto) =>
      this.request<Branch>('/api/branches', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    update: (id: string, dto: UpdateBranchDto) =>
      this.request<Branch>(`/api/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),

    deactivate: (id: string) =>
      this.request<Branch>(`/api/branches/${id}`, {
        method: 'DELETE',
      }),
  };

  // ──────────────────────────────────────────────
  // REZERVASYONLAR (MÜŞTERİ)
  // ──────────────────────────────────────────────
  public reservations = {
    searchAvailability: (params: {
      branchId: string;
      plannedPickupAt: string;
      plannedReturnAt: string;
      segmentId?: string;
      bodyTypeId?: string;
      fuelTypeId?: string;
      transmissionId?: string;
    }) => {
      const q = new URLSearchParams();
      q.set('branchId', params.branchId);
      q.set('plannedPickupAt', params.plannedPickupAt);
      q.set('plannedReturnAt', params.plannedReturnAt);
      if (params.segmentId) q.set('segmentId', params.segmentId);
      if (params.bodyTypeId) q.set('bodyTypeId', params.bodyTypeId);
      if (params.fuelTypeId) q.set('fuelTypeId', params.fuelTypeId);
      if (params.transmissionId) q.set('transmissionId', params.transmissionId);

      return this.request<AvailableGroup[]>(`/api/reservations/availability?${q.toString()}`, {
        method: 'GET',
      });
    },

    create: (dto: CreateReservationDto) =>
      this.request<Reservation>('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    getMy: () => this.request<Reservation[]>('/api/reservations/me', { method: 'GET' }),

    getById: (id: string) => this.request<Reservation>(`/api/reservations/${id}`, { method: 'GET' }),

    cancel: (id: string, reason: string) =>
      this.request<{ success: boolean; message: string }>(`/api/reservations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason } as CancelReservationDto),
      }),

    createChangeRequest: (id: string, dto: CreateChangeRequestDto) =>
      this.request<{ success: boolean; message: string }>(`/api/reservations/${id}/change-request`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  };

  // ──────────────────────────────────────────────
  // ÖDEMELER
  // ──────────────────────────────────────────────
  public payments = {
    charge: (dto: ProcessPaymentDto) =>
      this.request<PaymentResponse>('/api/payments/charge', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    getByReservation: (reservationId: string) =>
      this.request<PaymentResponse[]>(`/api/payments/reservation/${reservationId}`, {
        method: 'GET',
      }),
  };

  // ──────────────────────────────────────────────
  // RAPORLAR (ADMIN / DASHBOARD)
  // ──────────────────────────────────────────────
  public reports = {
    getDashboardSummary: () =>
      this.request<DashboardSummary>('/api/reports/dashboard', { method: 'GET' }),

    getRevenueReport: (filter?: { startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      if (filter?.startDate) q.set('startDate', filter.startDate);
      if (filter?.endDate) q.set('endDate', filter.endDate);
      return this.request<RevenueReport>(`/api/reports/revenue?${q.toString()}`, { method: 'GET' });
    },
  };

  // ──────────────────────────────────────────────
  // ŞUBE TESLİM / İADE (HANDOVER)
  // ──────────────────────────────────────────────
  public handover = {
    getAvailableVehicles: (reservationId: string) =>
      this.request<AdminVehicle[]>(`/api/handover/available-vehicles/${reservationId}`, { method: 'GET' }),

    getEligibleVehicles: (reservationId: string, params?: { page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      return this.request<PaginatedResponse<AdminVehicle>>(
        `/api/handover/eligible-vehicles/${reservationId}?${q.toString()}`,
        { method: 'GET' }
      );
    },

    deliver: (dto: DeliverVehicleDto) =>
      this.request<HandoverRecord>('/api/handover/deliver', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    return: (dto: ReturnVehicleDto) =>
      this.request<ReturnRecord>('/api/handover/return', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    markNoShow: (reservationId: string) =>
      this.request<{ success: boolean; message: string }>(`/api/handover/no-show/${reservationId}`, {
        method: 'POST',
      }),
  };

  // ──────────────────────────────────────────────
  // YÖNETİM & OPERASYON PANELİ (ADMIN)
  // ──────────────────────────────────────────────
  public admin = {
    // Araç Filosu
    vehicles: {
      getAll: (params?: {
        branchId?: string;
        state?: VehicleState;
        onlyActive?: boolean;
        limit?: number;
        offset?: number;
      }) => {
        const q = new URLSearchParams();
        if (params?.branchId) q.set('branchId', params.branchId);
        if (params?.state) q.set('state', params.state);
        if (params?.onlyActive !== undefined) q.set('onlyActive', String(params.onlyActive));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.offset) q.set('offset', String(params.offset));
        return this.request<AdminVehicle[]>(`/api/admin/vehicles?${q.toString()}`, { method: 'GET' });
      },

      getById: (id: string) =>
        this.request<AdminVehicle>(`/api/admin/vehicles/${id}`, { method: 'GET' }),

      create: (dto: CreateVehicleDto) =>
        this.request<AdminVehicle>('/api/admin/vehicles', {
          method: 'POST',
          body: JSON.stringify(dto),
        }),

      update: (id: string, dto: UpdateVehicleDto) =>
        this.request<AdminVehicle>(`/api/admin/vehicles/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        }),

      updateState: (id: string, dto: UpdateVehicleStateDto) =>
        this.request<AdminVehicle>(`/api/admin/vehicles/${id}/state`, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        }),
    },

    // Referans Katalogları
    references: {
      getCatalog: () =>
        this.request<ReferenceCatalog>('/api/vehicles/catalog', { method: 'GET' }),

      createBrand: (name: string) =>
        this.request<ReferenceItem>('/api/admin/vehicles/references/brands', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),

      createModel: (dto: { brandId: string; name: string }) =>
        this.request<ReferenceItem>('/api/admin/vehicles/references/models', {
          method: 'POST',
          body: JSON.stringify(dto),
        }),

      createBodyType: (name: string) =>
        this.request<ReferenceItem>('/api/admin/vehicles/references/body-types', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),

      createFuelType: (name: string) =>
        this.request<ReferenceItem>('/api/admin/vehicles/references/fuel-types', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),

      createTransmission: (name: string) =>
        this.request<ReferenceItem>('/api/admin/vehicles/references/transmissions', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),

      deactivateBrand: (id: string) =>
        this.request<ReferenceItem>(`/api/admin/vehicles/references/brands/${id}/deactivate`, {
          method: 'PATCH',
        }),

      deactivateModel: (id: string) =>
        this.request<ReferenceItem>(`/api/admin/vehicles/references/models/${id}/deactivate`, {
          method: 'PATCH',
        }),

      deactivateBodyType: (id: string) =>
        this.request<ReferenceItem>(`/api/admin/vehicles/references/body-types/${id}/deactivate`, {
          method: 'PATCH',
        }),

      deactivateFuelType: (id: string) =>
        this.request<ReferenceItem>(`/api/admin/vehicles/references/fuel-types/${id}/deactivate`, {
          method: 'PATCH',
        }),

      deactivateTransmission: (id: string) =>
        this.request<ReferenceItem>(`/api/admin/vehicles/references/transmissions/${id}/deactivate`, {
          method: 'PATCH',
        }),
    },

    // Rezervasyonlar ve Değişiklik Talepleri
    reservations: {
      getAll: (params?: {
        page?: number;
        limit?: number;
        branchId?: string;
        state?: string;
        customerId?: string;
        startDate?: string;
        endDate?: string;
      }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.branchId) q.set('branchId', params.branchId);
        if (params?.state) q.set('state', params.state);
        if (params?.customerId) q.set('customerId', params.customerId);
        if (params?.startDate) q.set('startDate', params.startDate);
        if (params?.endDate) q.set('endDate', params.endDate);
        return this.request<PaginatedResponse<Reservation>>(`/api/admin/reservations?${q.toString()}`, {
          method: 'GET',
        });
      },

      getChangeRequests: (params?: { page?: number; limit?: number; status?: string; reservationId?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.status) q.set('status', params.status);
        if (params?.reservationId) q.set('reservationId', params.reservationId);
        return this.request<PaginatedResponse<ReservationChangeRequest>>(
          `/api/admin/reservations/change-requests?${q.toString()}`,
          { method: 'GET' }
        );
      },

      reviewChangeRequest: (id: string, dto: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string }) =>
        this.request<{ success: boolean; message: string }>(`/api/reservations/change-requests/${id}/review`, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        }),
    },

    // Fiyat Matrisi
    pricing: {
      getMatrix: () => this.request<PriceMatrixItem[]>('/api/pricing', { method: 'GET' }),

      updatePrice: (segmentId: string, bodyTypeId: string, dto: UpdateDailyPriceDto) =>
        this.request<PriceMatrixItem>(`/api/pricing/${segmentId}/${bodyTypeId}`, {
          method: 'PUT',
          body: JSON.stringify(dto),
        }),
    },

    // Personel Yönetimi (SUPER_ADMIN)
    staff: {
      list: (params?: { limit?: number; offset?: number }) => {
        const q = new URLSearchParams();
        q.set('role', 'STAFF');
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.offset) q.set('offset', String(params.offset));
        return this.request<User[]>(`/api/users?${q.toString()}`, { method: 'GET' });
      },

      create: (dto: CreateStaffDto) =>
        this.request<User>('/api/admin/staff', {
          method: 'POST',
          body: JSON.stringify(dto),
        }),

      updatePermissions: (id: string, dto: UpdateStaffPermissionsDto) =>
        this.request<User>(`/api/admin/staff/${id}/permissions`, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        }),

      deactivate: (id: string) =>
        this.request<User>(`/api/admin/staff/${id}/deactivate`, {
          method: 'PATCH',
        }),
    },

    // Kimlik Düzeltme Talepleri (SUPER_ADMIN)
    profileCorrections: {
      list: (params?: { page?: number; limit?: number; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.status) q.set('status', params.status);
        return this.request<PaginatedResponse<ProfileCorrectionRequestItem>>(
          `/api/admin/profile-corrections?${q.toString()}`,
          { method: 'GET' }
        );
      },

      review: (id: string, dto: { status: 'APPROVED' | 'REJECTED'; adminNote?: string }) =>
        this.request<{ success: boolean; message: string }>(`/api/admin/profile-corrections/${id}/review`, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        }),
    },

    // Denetim Logları (SUPER_ADMIN)
    auditLogs: {
      list: (params?: { page?: number; limit?: number; action?: AuditAction; performedByUserId?: string; reservationId?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        if (params?.action) q.set('action', params.action);
        if (params?.performedByUserId) q.set('performedByUserId', params.performedByUserId);
        if (params?.reservationId) q.set('reservationId', params.reservationId);
        return this.request<PaginatedResponse<AuditLogItem>>(`/api/admin/audit-logs?${q.toString()}`, {
          method: 'GET',
        });
      },
    },
  };
}

export const api = new ApiClient();
