import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole, ReservationState } from '@prisma/client';
import {
  CreateCustomerProfileDto,
  UpdateCustomerProfileDto,
  CustomerProfileResponseDto,
} from './dto/customer-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  CreateStaffDto,
  UpdateStaffPermissionsDto,
  CloseAccountDto,
} from './dto/staff.dto';
import {
  ChangePhoneDto,
  VerifyEmailDto,
  CreateProfileCorrectionRequestDto,
  ReviewProfileCorrectionDto,
  ProfileCorrectionQueryDto,
} from './dto/profile-correction.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
    private auditService: AuditService,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: true,
        staffPermission: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    return this.mapToUserResponse(user);
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        customerProfile: true,
        staffPermission: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // ─── Customer Profile Creation / Initial Setup ───
  async createOrUpdateCustomerProfile(
    userId: string,
    dto: CreateCustomerProfileDto,
  ): Promise<CustomerProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    // 1. If profile already exists, do not allow rewriting core KYC fields via this endpoint
    if (user.customerProfile) {
      throw new BadRequestException(
        'Müşteri profiliniz zaten mevcuttur. Resmi kimlik bilgileri (Ad, Soyad, T.C. Kimlik No, Doğum Tarihi, Ehliyet Tarihi) güvenlik kuralları gereği sonradan değiştirilemez.',
      );
    }

    // 2. Compute deterministic HMAC-SHA256 for uniqueness
    const nationalIdHash = this.cryptoService.hashNationalId(dto.nationalId);

    // 3. Check if another profile already registered with this National ID
    const existingProfile = await this.prisma.customerProfile.findUnique({
      where: { nationalIdHash },
    });

    if (existingProfile && existingProfile.userId !== userId) {
      throw new ConflictException(
        'Bu T.C. Kimlik Numarası başka bir kullanıcı hesabında kayıtlıdır',
      );
    }

    // 4. Encrypt nationalId using AES-256-GCM for secure storage
    const nationalIdEncrypted = this.cryptoService.encryptNationalId(dto.nationalId);

    const birthDate = new Date(dto.birthDate);
    const licenseDate = new Date(dto.licenseDate);

    if (isNaN(birthDate.getTime()) || isNaN(licenseDate.getTime())) {
      throw new BadRequestException('Geçersiz tarih formatı');
    }

    if (birthDate >= new Date()) {
      throw new BadRequestException('Doğum tarihi bugünden ileri bir tarih olamaz');
    }

    if (licenseDate < birthDate) {
      throw new BadRequestException('Ehliyet tarihi doğum tarihinden önce olamaz');
    }

    const profile = await this.prisma.customerProfile.create({
      data: {
        userId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        birthDate,
        licenseDate,
        nationalIdHash,
        nationalIdEncrypted,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: userId,
      details: { action: 'CUSTOMER_PROFILE_CREATED' },
    });

    return this.mapToProfileResponse(profile);
  }

  // ─── Protected Partial Profile Update (Only non-KYC fields e.g. email) ───
  async updateCustomerProfile(
    userId: string,
    dto: UpdateCustomerProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true, staffPermission: true },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Bu e-posta adresi başka bir hesap tarafından kullanılmaktadır');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { email },
      });

      await this.auditService.log({
        action: AuditAction.USER_UPDATED,
        performedByUserId: userId,
        details: { action: 'EMAIL_UPDATED', newEmail: email },
      });
    }

    return this.findById(userId);
  }

  // ─── Customer Account Closure (GDPR / KVKK Anonymization) ───
  async closeCustomerAccount(userId: string, dto: CloseAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        reservations: {
          where: {
            state: { in: [ReservationState.ACTIVE, ReservationState.CONFIRMED, ReservationState.PENDING_PAYMENT] },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Yalnızca müşteri hesapları bu uç noktadan kapatılabilir');
    }

    if (user.reservations.length > 0) {
      throw new BadRequestException(
        'Devam eden veya onaylanmış bir rezervasyonunuz bulunmaktadır. Hesabınızı kapatmadan önce lütfen rezervasyonunuzu tamamlayınız veya iptal ediniz.',
      );
    }

    // 1. Deactivate user & anonymize login credentials
    const anonymizedSuffix = `_CLOSED_${user.id.slice(0, 8)}`;
    const randomDigits = Math.floor(100000 + Math.random() * 900000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        phone: `+900000${randomDigits}${anonymizedSuffix}`,
        email: `anonymized_${user.id.slice(0, 8)}@closed.local`,
      },
    });

    // 2. Anonymize CustomerProfile (preserve anonymized demographics, wipe encrypted sensitive fields)
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (profile) {
      await this.prisma.customerProfile.update({
        where: { userId },
        data: {
          firstName: 'ANONİM',
          lastName: 'MÜŞTERİ',
          nationalIdEncrypted: null, // Wipe sensitive ciphertext
        },
      });
    }

    // 3. Delete all active refresh tokens
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    // 4. Log Audit
    await this.auditService.log({
      action: AuditAction.USER_ACCOUNT_CLOSED,
      performedByUserId: userId,
      details: {
        reason: dto.reason || 'Müşteri talebiyle hesap kapatıldı ve kişisel veriler anonimleştirildi',
      },
    });

    return {
      success: true,
      message: 'Hesabınız başarıyla kapatıldı ve kişisel verileriniz KVKK uyumlu olarak anonimleştirildi.',
    };
  }

  // ─── Super Admin: Staff Management ───
  async createStaff(dto: CreateStaffDto): Promise<UserResponseDto> {
    const phone = dto.phone.trim();
    const email = dto.email.trim().toLowerCase();

    const existingPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new ConflictException('Bu telefon numarası zaten kullanımda');
    }

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('Bu e-posta adresi zaten kullanımda');
    }

    const passwordHash = await this.cryptoService.hashPassword(dto.password);

    const staffUser = await this.prisma.user.create({
      data: {
        phone,
        email,
        passwordHash,
        role: UserRole.STAFF,
        staffPermission: {
          create: {
            canManageVehicles: dto.canManageVehicles ?? false,
            canManageReservations: dto.canManageReservations ?? false,
            canManageUsers: dto.canManageUsers ?? false,
            canManageBranches: dto.canManageBranches ?? false,
            canManagePricing: dto.canManagePricing ?? false,
          },
        },
      },
      include: {
        staffPermission: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_CREATED,
      details: { role: UserRole.STAFF, staffId: staffUser.id },
    });

    return this.mapToUserResponse(staffUser);
  }

  async updateStaffPermissions(staffId: string, dto: UpdateStaffPermissionsDto): Promise<UserResponseDto> {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: { staffPermission: true },
    });

    if (!staff || staff.role !== UserRole.STAFF) {
      throw new NotFoundException('Personel bulunamadı');
    }

    await this.prisma.staffPermission.upsert({
      where: { userId: staffId },
      update: {
        ...(dto.canManageVehicles !== undefined && { canManageVehicles: dto.canManageVehicles }),
        ...(dto.canManageReservations !== undefined && { canManageReservations: dto.canManageReservations }),
        ...(dto.canManageUsers !== undefined && { canManageUsers: dto.canManageUsers }),
        ...(dto.canManageBranches !== undefined && { canManageBranches: dto.canManageBranches }),
        ...(dto.canManagePricing !== undefined && { canManagePricing: dto.canManagePricing }),
      },
      create: {
        userId: staffId,
        canManageVehicles: dto.canManageVehicles ?? false,
        canManageReservations: dto.canManageReservations ?? false,
        canManageUsers: dto.canManageUsers ?? false,
        canManageBranches: dto.canManageBranches ?? false,
        canManagePricing: dto.canManagePricing ?? false,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      details: { action: 'STAFF_PERMISSIONS_UPDATED', staffId, updatedPermissions: dto },
    });

    return this.findById(staffId);
  }

  async deactivateStaff(staffId: string): Promise<UserResponseDto> {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff || staff.role !== UserRole.STAFF) {
      throw new NotFoundException('Personel bulunamadı');
    }

    // Deactivate staff
    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: { isActive: false },
      include: { staffPermission: true },
    });

    // Invalidate all active sessions for this staff member
    await this.prisma.refreshToken.deleteMany({ where: { userId: staffId } });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      details: { action: 'STAFF_DEACTIVATED', staffId },
    });

    return this.mapToUserResponse(updated);
  }

  // ─── List Users with Staff RBAC enforcement ───
  async listUsers(
    requestingUser: { id: string; role: UserRole },
    roleFilter?: UserRole,
    limit = 50,
    offset = 0,
  ) {
    if (requestingUser.role === UserRole.STAFF) {
      const permission = await this.prisma.staffPermission.findUnique({
        where: { userId: requestingUser.id },
      });
      if (!permission || !permission.canManageUsers) {
        throw new ForbiddenException(
          'Yetkisiz işlem: Kullanıcıları görüntülemek için canManageUsers personel yetkisi gereklidir.',
        );
      }
    }

    const safeLimit = Math.min(100, Math.max(1, limit || 50));
    const safeOffset = Math.max(0, offset || 0);

    const users = await this.prisma.user.findMany({
      where: roleFilter ? { role: roleFilter } : undefined,
      include: {
        customerProfile: true,
        staffPermission: true,
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      skip: safeOffset,
    });

    return users.map((u) => this.mapToUserResponse(u));
  }

  // ─── Helpers ───
  public mapToProfileResponse(profile: any): CustomerProfileResponseDto {
    let plainNationalId = '';
    if (profile.nationalIdEncrypted) {
      try {
        plainNationalId = this.cryptoService.decryptNationalId(
          profile.nationalIdEncrypted,
        );
      } catch {
        plainNationalId = '';
      }
    }

    const birth = new Date(profile.birthDate);
    const license = new Date(profile.licenseDate);
    const now = new Date();

    const age = Math.floor(
      (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    const licenseYears = Math.floor(
      (now.getTime() - license.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );

    return {
      id: profile.id,
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      birthDate: birth.toISOString().split('T')[0],
      licenseDate: license.toISOString().split('T')[0],
      maskedNationalId: plainNationalId
        ? this.cryptoService.maskNationalId(plainNationalId)
        : '***********',
      calculatedAge: Math.max(0, age),
      calculatedLicenseYears: Math.max(0, licenseYears),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  public mapToUserResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      customerProfile: user.customerProfile
        ? this.mapToProfileResponse(user.customerProfile)
        : null,
      staffPermission: user.staffPermission
        ? {
            canManageVehicles: user.staffPermission.canManageVehicles,
            canManageReservations: user.staffPermission.canManageReservations,
            canManageUsers: user.staffPermission.canManageUsers,
            canManageBranches: user.staffPermission.canManageBranches,
            canManagePricing: user.staffPermission.canManagePricing,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ─── Change Phone with SMS Verification ───
  async changePhone(userId: string, dto: ChangePhoneDto) {
    let cleanPhone = dto.newPhone.trim().replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '+90' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('5')) {
      cleanPhone = '+90' + cleanPhone;
    } else if (!cleanPhone.startsWith('+90') && cleanPhone.startsWith('905')) {
      cleanPhone = '+' + cleanPhone;
    }

    const existing = await this.prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Bu telefon numarası başka bir kullanıcı tarafından kullanılmaktadır.');
    }

    // Verify SMS verification code
    const now = new Date();
    const smsRecord = await this.prisma.smsVerificationCode.findFirst({
      where: {
        phone: cleanPhone,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!smsRecord || smsRecord.code !== dto.code.trim()) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş SMS doğrulama kodu.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.smsVerificationCode.update({
        where: { id: smsRecord.id },
        data: { usedAt: now },
      });

      await tx.user.update({
        where: { id: userId },
        data: { phone: cleanPhone },
      });
    });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: userId,
      details: { action: 'PHONE_CHANGED', newPhone: cleanPhone },
    });

    return {
      success: true,
      message: 'Telefon numaranız başarıyla güncellendi.',
      phone: cleanPhone,
    };
  }

  // ─── Verify Email (Sandbox Simulation) ───
  async verifyEmail(userId: string, dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: userId,
      details: { action: 'EMAIL_VERIFIED_SANDBOX', email: dto.email || user.email },
    });

    return {
      success: true,
      message: 'E-posta adresiniz başarıyla doğrulandı (Sandbox simülasyonu).',
      email: dto.email || user.email,
    };
  }

  // ─── Create Profile Correction Request (Customer) ───
  async createProfileCorrectionRequest(
    userId: string,
    dto: CreateProfileCorrectionRequestDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user || !user.customerProfile) {
      throw new BadRequestException('Önce müşteri profilinizi oluşturmalısınız.');
    }

    const pendingRequest = await this.prisma.profileCorrectionRequest.findFirst({
      where: {
        userId,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      throw new ConflictException(
        'Halihazırda inceleme aşamasında bekleyen bir profil düzeltme talebiniz bulunmaktadır.',
      );
    }

    const request = await this.prisma.profileCorrectionRequest.create({
      data: {
        userId,
        requestedFirstName: dto.requestedFirstName?.trim(),
        requestedLastName: dto.requestedLastName?.trim(),
        requestedBirthDate: dto.requestedBirthDate ? new Date(dto.requestedBirthDate) : null,
        requestedLicenseDate: dto.requestedLicenseDate ? new Date(dto.requestedLicenseDate) : null,
        requestedNationalId: dto.requestedNationalId?.trim(),
        reason: dto.reason.trim(),
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      action: AuditAction.PROFILE_CORRECTION_REQUESTED,
      performedByUserId: userId,
      details: {
        requestId: request.id,
        reason: dto.reason,
      },
    });

    return {
      success: true,
      message: 'Profil düzeltme talebiniz oluşturuldu ve yönetici incelemesine gönderildi.',
      data: request,
    };
  }

  // ─── List Profile Corrections (SUPER_ADMIN) ───
  async getPaginatedProfileCorrections(
    query: ProfileCorrectionQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.userId) {
      where.userId = query.userId;
    }

    const [total, items] = await Promise.all([
      this.prisma.profileCorrectionRequest.count({ where }),
      this.prisma.profileCorrectionRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              customerProfile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    const sanitizedItems = items.map((item) => ({
      ...item,
      requestedNationalId: item.requestedNationalId
        ? this.cryptoService.maskNationalId(item.requestedNationalId)
        : null,
      user: {
        id: item.user.id,
        email: item.user.email,
        phone: item.user.phone,
        customerProfile: item.user.customerProfile
          ? this.mapToProfileResponse(item.user.customerProfile)
          : null,
      },
    }));

    return {
      data: sanitizedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ─── Review Profile Correction (SUPER_ADMIN) ───
  async reviewProfileCorrection(
    requestId: string,
    adminUserId: string,
    dto: ReviewProfileCorrectionDto,
  ) {
    const correctionRequest = await this.prisma.profileCorrectionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { include: { customerProfile: true } },
      },
    });

    if (!correctionRequest) {
      throw new NotFoundException('Profil düzeltme talebi bulunamadı.');
    }

    if (correctionRequest.status !== 'PENDING') {
      throw new BadRequestException('Bu talep daha önce sonuçlandırılmıştır.');
    }

    if (dto.status === 'REJECTED') {
      await this.prisma.profileCorrectionRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: adminUserId,
          reviewNote: dto.reviewNote,
        },
      });

      await this.auditService.log({
        action: AuditAction.PROFILE_CORRECTION_REVIEWED,
        performedByUserId: adminUserId,
        details: { requestId, status: 'REJECTED', reviewNote: dto.reviewNote },
      });

      return {
        success: true,
        message: 'Profil düzeltme talebi reddedildi.',
      };
    }

    // APPROVED: Atomically update CustomerProfile and complete request
    const profile = correctionRequest.user.customerProfile;
    if (!profile) {
      throw new BadRequestException('Kullanıcıya ait müşteri profili bulunamadı.');
    }

    let updatedHash = profile.nationalIdHash;
    let updatedEncrypted = profile.nationalIdEncrypted;

    if (correctionRequest.requestedNationalId) {
      updatedHash = this.cryptoService.hashNationalId(correctionRequest.requestedNationalId);
      const existing = await this.prisma.customerProfile.findUnique({
        where: { nationalIdHash: updatedHash },
      });
      if (existing && existing.userId !== correctionRequest.userId) {
        throw new ConflictException(
          'Talep edilen T.C. Kimlik Numarası başka bir kullanıcı hesabında zaten kayıtlıdır.',
        );
      }
      updatedEncrypted = this.cryptoService.encryptNationalId(
        correctionRequest.requestedNationalId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customerProfile.update({
        where: { id: profile.id },
        data: {
          firstName: correctionRequest.requestedFirstName || profile.firstName,
          lastName: correctionRequest.requestedLastName || profile.lastName,
          birthDate: correctionRequest.requestedBirthDate || profile.birthDate,
          licenseDate: correctionRequest.requestedLicenseDate || profile.licenseDate,
          nationalIdHash: updatedHash,
          nationalIdEncrypted: updatedEncrypted,
        },
      });

      await tx.profileCorrectionRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminUserId,
          reviewNote: dto.reviewNote,
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.PROFILE_CORRECTION_REVIEWED,
      performedByUserId: adminUserId,
      details: {
        requestId,
        userId: correctionRequest.userId,
        status: 'APPROVED',
        reviewNote: dto.reviewNote,
      },
    });

    return {
      success: true,
      message: 'Profil düzeltme talebi onaylandı ve müşteri profili başarıyla güncellendi.',
    };
  }
}
