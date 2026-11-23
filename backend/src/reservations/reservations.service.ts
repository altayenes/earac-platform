import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  ReservationState,
  UserRole,
  VehicleState,
  PaymentStatus,
  PaymentType,
} from '@prisma/client';
import {
  AvailabilitySearchDto,
  AvailableGroupResponseDto,
  CreateReservationDto,
  CreateChangeRequestDto,
  ReviewChangeRequestDto,
  CancelReservationDto,
  ReservationResponseDto,
  AdminReservationQueryDto,
  AdminChangeRequestQueryDto,
} from './dto/reservation.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

export const TURNAROUND_BUFFER_HOURS = 2; // 2 saatlik hazırlık tamponu
export const PAYMENT_HOLD_MINUTES = 15; // 15 dakikalık ödeme blokesi

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ─── Europe/Istanbul Timezone Helper & Branch Operating Hours ───
  public getIstanbulTimeString(date: Date): string {
    const formatter = new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value.padStart(2, '0') || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value.padStart(2, '0') || '00';
    return `${hour}:${minute}`;
  }

  public validateBranchOperatingHours(
    branch: { name: string; openingTime: string; closingTime: string },
    pickup: Date,
    returnDate: Date,
  ): void {
    const pickupTime = this.getIstanbulTimeString(pickup);
    const returnTime = this.getIstanbulTimeString(returnDate);

    if (pickupTime < branch.openingTime || pickupTime > branch.closingTime) {
      throw new BadRequestException(
        `Alış saati (${pickupTime}), ${branch.name} şubesinin çalışma saatleri (${branch.openingTime} - ${branch.closingTime}) dışındadır (Europe/Istanbul).`,
      );
    }
    if (returnTime < branch.openingTime || returnTime > branch.closingTime) {
      throw new BadRequestException(
        `İade saati (${returnTime}), ${branch.name} şubesinin çalışma saatleri (${branch.openingTime} - ${branch.closingTime}) dışındadır (Europe/Istanbul).`,
      );
    }
  }

  // ─── 1. Calculate Duration in Days (min 1 day, 24-hr blocks) ───
  public calculateRentalDays(pickup: Date, returnDate: Date): number {
    const diffMs = returnDate.getTime() - pickup.getTime();
    if (diffMs <= 0) return 0;
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return Math.max(1, days);
  }

  // ─── 2. Fixed Eligibility Business Rules Check ───
  public checkEligibility(
    customerProfile: { birthDate: Date; licenseDate: Date },
    segment: { name: string; minAge: number; minLicenseYears: number },
    pickupDate: Date,
  ): { isEligible: boolean; reason?: string } {
    const ageAtPickup = Math.floor(
      (pickupDate.getTime() - new Date(customerProfile.birthDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000),
    );
    const licenseYearsAtPickup = Math.floor(
      (pickupDate.getTime() - new Date(customerProfile.licenseDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000),
    );

    if (ageAtPickup < segment.minAge) {
      return {
        isEligible: false,
        reason: `${segment.name} segmenti için asgari yaş sınırı ${segment.minAge}'dir (Kiralama tarihindeki yaşınız: ${ageAtPickup}).`,
      };
    }

    if (licenseYearsAtPickup < segment.minLicenseYears) {
      return {
        isEligible: false,
        reason: `${segment.name} segmenti için asgari ehliyet süresi ${segment.minLicenseYears} yıldır (Kiralama tarihindeki ehliyet süreniz: ${licenseYearsAtPickup} yıl).`,
      };
    }

    return { isEligible: true };
  }

  // ─── 3. Group-Based Availability Search with Full Specs (NO VIN, NO PLATE) ───
  async searchAvailability(
    dto: AvailabilitySearchDto,
  ): Promise<AvailableGroupResponseDto[]> {
    const pickupDate = new Date(dto.plannedPickupAt);
    const returnDate = new Date(dto.plannedReturnAt);
    const now = new Date();

    if (pickupDate < now) {
      throw new BadRequestException('Alış tarihi geçmiş bir tarih olamaz');
    }

    if (returnDate <= pickupDate) {
      throw new BadRequestException('İade tarihi alış tarihinden sonra olmalıdır');
    }

    const totalDays = this.calculateRentalDays(pickupDate, returnDate);

    // Turnaround buffer
    const bufferReturnDate = new Date(
      returnDate.getTime() + TURNAROUND_BUFFER_HOURS * 60 * 60 * 1000,
    );
    const bufferPickupDate = new Date(
      pickupDate.getTime() - TURNAROUND_BUFFER_HOURS * 60 * 60 * 1000,
    );

    // 1. Get all active vehicles at branch (matching optional filters)
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        branchId: dto.branchId,
        isActive: true,
        state: { notIn: [VehicleState.INACTIVE, VehicleState.DAMAGED_OUT_OF_SERVICE] },
        segmentId: dto.segmentId,
        bodyTypeId: dto.bodyTypeId,
        fuelTypeId: dto.fuelTypeId,
        transmissionId: dto.transmissionId,
      },
      include: {
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
      },
    });

    if (vehicles.length === 0) {
      return [];
    }

    // 2. Count overlapping reservations at this branch:
    const overlappingReservations = await this.prisma.reservation.findMany({
      where: {
        branchId: dto.branchId,
        startTime: { lt: bufferReturnDate },
        endTime: { gt: bufferPickupDate },
        OR: [
          { state: { in: [ReservationState.ACTIVE, ReservationState.CONFIRMED] } },
          {
            state: ReservationState.PENDING_PAYMENT,
            expiresAt: { gt: now },
          },
        ],
      },
      include: {
        priceSnapshot: true,
      },
    });

    // 3. Group vehicles by full exact match: (segmentId, bodyTypeId, fuelTypeId, transmissionId)
    const groupMap = new Map<
      string,
      {
        segment: any;
        bodyType: any;
        fuelType: any;
        transmission: any;
        totalVehicles: number;
      }
    >();

    for (const v of vehicles) {
      const key = `${v.segmentId}_${v.bodyTypeId}_${v.fuelTypeId}_${v.transmissionId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          segment: v.segment,
          bodyType: v.bodyType,
          fuelType: v.fuelType,
          transmission: v.transmission,
          totalVehicles: 0,
        });
      }
      groupMap.get(key)!.totalVehicles++;
    }

    // 4. Calculate overlapping counts per group
    const occupiedCountMap = new Map<string, number>();
    for (const res of overlappingReservations) {
      if (res.priceSnapshot && res.priceSnapshot.fuelTypeId && res.priceSnapshot.transmissionTypeId) {
        const matchedVehicle = vehicles.find(
          (v) =>
            v.segment.name === res.priceSnapshot!.segmentName &&
            v.bodyType.name === res.priceSnapshot!.bodyTypeName &&
            v.fuelTypeId === res.priceSnapshot!.fuelTypeId &&
            v.transmissionId === res.priceSnapshot!.transmissionTypeId,
        );
        if (matchedVehicle) {
          const key = `${matchedVehicle.segmentId}_${matchedVehicle.bodyTypeId}_${matchedVehicle.fuelTypeId}_${matchedVehicle.transmissionId}`;
          occupiedCountMap.set(key, (occupiedCountMap.get(key) || 0) + 1);
        }
      }
    }

    // 5. Fetch daily pricing and build response
    const results: AvailableGroupResponseDto[] = [];
    for (const [key, group] of groupMap.entries()) {
      const occupied = occupiedCountMap.get(key) || 0;
      const availableCount = Math.max(0, group.totalVehicles - occupied);

      if (availableCount > 0) {
        const pricing = await this.prisma.segmentBodyTypePrice.findUnique({
          where: {
            segmentId_bodyTypeId: {
              segmentId: group.segment.id,
              bodyTypeId: group.bodyType.id,
            },
          },
        });

        if (pricing && pricing.isActive) {
          const dailyPrice = Number(pricing.dailyPrice);
          results.push({
            segmentId: group.segment.id,
            segmentName: group.segment.name,
            minAge: group.segment.minAge,
            minLicenseYears: group.segment.minLicenseYears,
            bodyTypeId: group.bodyType.id,
            bodyTypeName: group.bodyType.name,
            fuelTypeId: group.fuelType.id,
            fuelTypeName: group.fuelType.name,
            transmissionTypeId: group.transmission.id,
            transmissionTypeName: group.transmission.name,
            dailyPrice,
            totalDays,
            totalAmount: dailyPrice * totalDays,
            availableCount,
          });
        }
      }
    }

    // İnce Kural: İstenen filtreli grupta müsaitlik 0 ise aynı şube ve tarihteki diğer alternatifleri öner
    const hasSpecificFilter = !!(
      dto.segmentId ||
      dto.bodyTypeId ||
      dto.fuelTypeId ||
      dto.transmissionId
    );
    if (hasSpecificFilter && results.length === 0) {
      const alternatives = await this.searchAvailability({
        branchId: dto.branchId,
        plannedPickupAt: dto.plannedPickupAt,
        plannedReturnAt: dto.plannedReturnAt,
      });
      (results as any).alternatives = alternatives;
    }

    return results;
  }

  // ─── 4. Atomic Capacity Check & Reservation Creation (Exact Match Lock) ───
  async createReservation(
    userId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const pickupDate = new Date(dto.plannedPickupAt);
    const returnDate = new Date(dto.plannedReturnAt);
    const now = new Date();

    if (pickupDate < now) {
      throw new BadRequestException('Alış tarihi geçmiş bir tarih olamaz');
    }

    if (returnDate <= pickupDate) {
      throw new BadRequestException('İade tarihi alış tarihinden sonra olmalıdır');
    }

    // OWASP API6: Filo Kilitleme Koruması (Bekleyen süresi dolmamış rezervasyon varsa yeni oluşturulamaz)
    const activeHold = await this.prisma.reservation.findFirst({
      where: {
        customerId: userId,
        state: ReservationState.PENDING_PAYMENT,
        expiresAt: { gt: now },
      },
    });

    if (activeHold) {
      throw new ConflictException(
        'Aktif bir ödeme süreciniz bulunmaktadır. Lütfen mevcut rezervasyonunuzu tamamlayın veya iptal ediniz.',
      );
    }

    // 1. Verify Customer Profile
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user || !user.customerProfile) {
      throw new BadRequestException(
        'Rezervasyon yapabilmek için lütfen önce müşteri profilinizi tamamlayınız.',
      );
    }

    // 2. Verify Specs Existence
    const [segment, bodyType, fuelType, transmission, branch] = await Promise.all([
      this.prisma.segment.findUnique({ where: { id: dto.segmentId } }),
      this.prisma.bodyType.findUnique({ where: { id: dto.bodyTypeId } }),
      this.prisma.fuelType.findUnique({ where: { id: dto.fuelTypeId } }),
      this.prisma.transmissionType.findUnique({ where: { id: dto.transmissionId } }),
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
    ]);

    if (!segment || !segment.isActive) throw new NotFoundException('Segment bulunamadı');
    if (!bodyType || !bodyType.isActive) throw new NotFoundException('Kasa tipi bulunamadı');
    if (!fuelType || !fuelType.isActive) throw new NotFoundException('Yakıt tipi bulunamadı');
    if (!transmission || !transmission.isActive) throw new NotFoundException('Vites tipi bulunamadı');
    if (!branch || !branch.isActive) throw new NotFoundException('Şube bulunamadı');

    // Şube Çalışma Saatleri Kontrolü (Europe/Istanbul)
    this.validateBranchOperatingHours(branch, pickupDate, returnDate);

    const eligibility = this.checkEligibility(user.customerProfile, segment, pickupDate);
    if (!eligibility.isEligible) {
      throw new ForbiddenException(eligibility.reason);
    }

    // 3. Pricing
    const pricing = await this.prisma.segmentBodyTypePrice.findUnique({
      where: {
        segmentId_bodyTypeId: {
          segmentId: dto.segmentId,
          bodyTypeId: dto.bodyTypeId,
        },
      },
    });

    if (!pricing || !pricing.isActive) {
      throw new BadRequestException('Seçilen araç grubu için aktif bir fiyat tanımlanmamıştır');
    }

    const totalDays = this.calculateRentalDays(pickupDate, returnDate);
    const dailyPrice = Number(pricing.dailyPrice);
    const totalAmount = dailyPrice * totalDays;

    const bufferReturnDate = new Date(
      returnDate.getTime() + TURNAROUND_BUFFER_HOURS * 60 * 60 * 1000,
    );
    const bufferPickupDate = new Date(
      pickupDate.getTime() - TURNAROUND_BUFFER_HOURS * 60 * 60 * 1000,
    );

    // 4. ATOMIC TRANSACTION WITH FULL 5-TUPLE ADVISORY LOCK
    const reservation = await this.prisma.$transaction(async (tx) => {
      // 5-tuple lock key: branchId + segmentId + bodyTypeId + fuelTypeId + transmissionId
      const lockKey = `capacity_${dto.branchId}_${dto.segmentId}_${dto.bodyTypeId}_${dto.fuelTypeId}_${dto.transmissionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Count total operational vehicles in this exact group & branch
      const totalVehicles = await tx.vehicle.count({
        where: {
          branchId: dto.branchId,
          segmentId: dto.segmentId,
          bodyTypeId: dto.bodyTypeId,
          fuelTypeId: dto.fuelTypeId,
          transmissionId: dto.transmissionId,
          isActive: true,
          state: { notIn: [VehicleState.INACTIVE, VehicleState.DAMAGED_OUT_OF_SERVICE] },
        },
      });

      if (totalVehicles === 0) {
        throw new ConflictException(
          'Seçilen şubede bu tam eşleşen araç grubuna ait filo kapasitesi bulunmamaktadır.',
        );
      }

      // Count overlapping active reservations in this exact group
      const overlappingCount = await tx.reservation.count({
        where: {
          branchId: dto.branchId,
          startTime: { lt: bufferReturnDate },
          endTime: { gt: bufferPickupDate },
          priceSnapshot: {
            segmentName: segment.name,
            bodyTypeName: bodyType.name,
            fuelTypeId: dto.fuelTypeId,
            transmissionTypeId: dto.transmissionId,
          },
          OR: [
            { state: { in: [ReservationState.ACTIVE, ReservationState.CONFIRMED] } },
            {
              state: ReservationState.PENDING_PAYMENT,
              expiresAt: { gt: now },
            },
          ],
        },
      });

      if (overlappingCount >= totalVehicles) {
        throw new ConflictException(
          'Seçilen tarih aralığında ve grupta tüm araçlar doludur (2 saatlik hazırlık tamponu dahil).',
        );
      }

      const expiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000);

      const created = await tx.reservation.create({
        data: {
          customerId: userId,
          branchId: dto.branchId,
          startTime: pickupDate,
          endTime: returnDate,
          state: ReservationState.PENDING_PAYMENT,
          expiresAt,
          vehicleId: null,
          priceSnapshot: {
            create: {
              segmentName: segment.name,
              bodyTypeName: bodyType.name,
              fuelTypeName: fuelType.name,
              transmissionTypeName: transmission.name,
              fuelTypeId: dto.fuelTypeId,
              transmissionTypeId: dto.transmissionId,
              dailyPrice,
              totalDays,
              totalAmount,
              currency: 'TRY',
            },
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: ReservationState.PENDING_PAYMENT,
              changedById: userId,
              reason: 'RESERVATION_CREATED_AWAITING_PAYMENT',
            },
          },
        },
        include: {
          branch: true,
          priceSnapshot: true,
        },
      });

      return created;
    });

    await this.auditService.log({
      action: AuditAction.RESERVATION_CREATED,
      performedByUserId: userId,
      reservationId: reservation.id,
      details: {
        totalAmount,
        totalDays,
        segment: segment.name,
        bodyType: bodyType.name,
        fuel: fuelType.name,
        transmission: transmission.name,
        expiresAt: reservation.expiresAt,
      },
    });

    return this.mapToDto(reservation);
  }

  // ─── 5. Customer Reservations Listing ───
  async findUserReservations(
    userId: string,
    limit?: number,
  ): Promise<ReservationResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, limit || 50));
    const reservations = await this.prisma.reservation.findMany({
      where: { customerId: userId },
      include: {
        branch: true,
        priceSnapshot: true,
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    return reservations.map((r) => this.mapToDto(r));
  }

  // ─── IDOR Protection: findReservationById ───
  async findReservationById(
    id: string,
    requestingUser: { id: string; role: UserRole },
  ): Promise<ReservationResponseDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        branch: true,
        priceSnapshot: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    // SUPER_ADMIN and STAFF can inspect all reservations
    if (requestingUser.role === UserRole.SUPER_ADMIN || requestingUser.role === UserRole.STAFF) {
      return this.mapToDto(reservation);
    }

    // CUSTOMER role MUST be the owner of the reservation (IDOR Protection)
    if (reservation.customerId !== requestingUser.id) {
      throw new ForbiddenException('Bu rezervasyonu görüntüleme yetkiniz bulunmamaktadır.');
    }

    return this.mapToDto(reservation);
  }

  // ─── Customer Cancellation (POST /api/reservations/:id/cancel) ───
  async cancelReservation(
    reservationId: string,
    userId: string,
    userRole: UserRole,
    dto: CancelReservationDto,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        priceSnapshot: true,
        payments: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    // IDOR Protection: only owner or staff/admin can cancel
    if (userRole === UserRole.CUSTOMER && reservation.customerId !== userId) {
      throw new ForbiddenException('Yalnızca kendi rezervasyonunuzu iptal edebilirsiniz');
    }

    // Active rentals cannot be cancelled via this endpoint
    if (reservation.state === ReservationState.ACTIVE) {
      throw new BadRequestException('Aktif kiralama aşamasındaki araçlar bu uçtan iptal edilemez. Lütfen iade sürecini başlatınız.');
    }

    if (
      reservation.state !== ReservationState.CONFIRMED &&
      reservation.state !== ReservationState.PENDING_PAYMENT
    ) {
      throw new BadRequestException(
        `Yalnızca CONFIRMED veya PENDING_PAYMENT durumundaki rezervasyonlar iptal edilebilir (Mevcut durum: ${reservation.state})`,
      );
    }

    const previousState = reservation.state;

    // Check if there was a successful charge payment -> automatically issue full REFUND
    const successfulPayment = (reservation.payments || []).find(
      (p) => p.type === PaymentType.CHARGE && p.status === PaymentStatus.SUCCESS,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. Update reservation state to CANCELLED
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          state: ReservationState.CANCELLED,
          expiresAt: null,
        },
      });

      // 2. If paid, create automatic full refund record
      if (successfulPayment) {
        await tx.payment.create({
          data: {
            reservationId,
            userId: reservation.customerId,
            amount: successfulPayment.amount,
            currency: successfulPayment.currency,
            type: PaymentType.REFUND,
            status: PaymentStatus.SUCCESS,
            idempotencyKey: `refund_${reservationId}_${Date.now()}`,
            providerRef: `ref_sandbox_refund_${Date.now()}`,
          },
        });
      }

      // 3. Record status history
      await tx.reservationStatusHistory.create({
        data: {
          reservationId,
          fromStatus: previousState,
          toStatus: ReservationState.CANCELLED,
          changedById: userId,
          reason: dto.reason || 'Müşteri talebiyle rezervasyon iptal edildi ve tam iade yapıldı.',
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.RESERVATION_CANCELLED,
      performedByUserId: userId,
      reservationId,
      details: {
        reason: dto.reason,
        refundedAmount: successfulPayment ? Number(successfulPayment.amount) : 0,
      },
    });

    return {
      success: true,
      message: successfulPayment
        ? 'Rezervasyon başarıyla iptal edildi ve ödenen kira bedelinin tamamı iade edildi.'
        : 'Rezervasyon başarıyla iptal edildi.',
    };
  }

  // ─── 6. Reservation Change Requests (Customer) ───
  async createChangeRequest(
    reservationId: string,
    userId: string,
    dto: CreateChangeRequestDto,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (reservation.customerId !== userId) {
      throw new ForbiddenException('Yalnızca kendi rezervasyonunuz için değişiklik talep edebilirsiniz');
    }

    if (reservation.state !== ReservationState.CONFIRMED) {
      throw new BadRequestException(
        'Yalnızca onaylanmış (CONFIRMED) durumdaki rezervasyonlar için değişiklik talep edilebilir',
      );
    }

    const changeRequest = await this.prisma.reservationChangeRequest.create({
      data: {
        reservationId,
        requestedStartTime: dto.requestedPickupAt ? new Date(dto.requestedPickupAt) : null,
        requestedEndTime: dto.requestedReturnAt ? new Date(dto.requestedReturnAt) : null,
        requestedSegmentId: dto.requestedSegmentId,
        requestedBodyTypeId: dto.requestedBodyTypeId,
        requestedFuelTypeId: dto.requestedFuelTypeId,
        requestedTransmissionTypeId: dto.requestedTransmissionTypeId,
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      action: AuditAction.RESERVATION_UPDATED,
      performedByUserId: userId,
      reservationId,
      details: { action: 'CHANGE_REQUEST_CREATED', requestId: changeRequest.id },
    });

    return {
      success: true,
      message: 'Değişiklik talebiniz oluşturuldu ve yönetici onayına sunuldu. Onaylanana kadar mevcut rezervasyonunuz geçerliliğini korur.',
      changeRequest,
    };
  }

  // ─── 7. Review Change Request with Advisory Lock Capacity Verification ───
  async reviewChangeRequest(
    requestId: string,
    staffUserId: string,
    dto: ReviewChangeRequestDto,
  ) {
    const changeRequest = await this.prisma.reservationChangeRequest.findUnique({
      where: { id: requestId },
      include: { reservation: { include: { priceSnapshot: true } } },
    });

    if (!changeRequest) {
      throw new NotFoundException('Değişiklik talebi bulunamadı');
    }

    if (changeRequest.status !== 'PENDING') {
      throw new BadRequestException('Bu talep zaten sonuçlandırılmıştır');
    }

    if (dto.status === 'REJECTED') {
      await this.prisma.reservationChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: staffUserId,
          reviewNote: dto.reviewNote,
        },
      });

      return { success: true, message: 'Değişiklik talebi reddedildi.' };
    }

    // IF APPROVED: Atomically verify capacity for new dates / group using advisory lock
    const res = changeRequest.reservation;
    const newStart = changeRequest.requestedStartTime || res.startTime;
    const newEnd = changeRequest.requestedEndTime || res.endTime;

    // Calculate price difference
    const oldTotalAmount = Number(res.priceSnapshot?.totalAmount || 0);
    const newDays = this.calculateRentalDays(newStart, newEnd);
    let newDailyPrice = Number(res.priceSnapshot?.dailyPrice || 0);

    if (changeRequest.requestedSegmentId && changeRequest.requestedBodyTypeId) {
      const pricing = await this.prisma.segmentBodyTypePrice.findUnique({
        where: {
          segmentId_bodyTypeId: {
            segmentId: changeRequest.requestedSegmentId,
            bodyTypeId: changeRequest.requestedBodyTypeId,
          },
        },
      });
      if (pricing && pricing.isActive) {
        newDailyPrice = Number(pricing.dailyPrice);
      }
    }

    const newTotalAmount = newDailyPrice * newDays;
    const priceDifference = Number((newTotalAmount - oldTotalAmount).toFixed(2));

    await this.prisma.$transaction(async (tx) => {
      // Advisory lock
      const lockKey = `capacity_${res.branchId}_change_${requestId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Update reservation dates
      await tx.reservation.update({
        where: { id: changeRequest.reservationId },
        data: {
          startTime: newStart,
          endTime: newEnd,
        },
      });

      // Update price snapshot if pricing or dates changed
      if (res.priceSnapshot) {
        await tx.reservationPriceSnapshot.update({
          where: { id: res.priceSnapshot.id },
          data: {
            totalDays: newDays,
            dailyPrice: newDailyPrice,
            totalAmount: newTotalAmount,
          },
        });
      }

      await tx.reservationChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: staffUserId,
          reviewNote: dto.reviewNote,
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.RESERVATION_UPDATED,
      performedByUserId: staffUserId,
      reservationId: changeRequest.reservationId,
      details: {
        action: 'CHANGE_REQUEST_APPROVED',
        requestId,
        priceDifference,
        oldTotalAmount,
        newTotalAmount,
      },
    });

    return {
      success: true,
      message: 'Değişiklik talebi onaylandı ve rezervasyon güncellendi.',
      priceDifference,
      oldTotalAmount,
      newTotalAmount,
    };
  }

  // ─── 8. Cron: Expire Stale PENDING_PAYMENT Holds ───
  async expirePendingReservations(): Promise<number> {
    const now = new Date();

    const staleReservations = await this.prisma.reservation.findMany({
      where: {
        state: ReservationState.PENDING_PAYMENT,
        expiresAt: { lte: now },
      },
      select: { id: true },
    });

    if (staleReservations.length === 0) {
      return 0;
    }

    let expiredCount = 0;
    for (const r of staleReservations) {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: r.id },
          data: { state: ReservationState.EXPIRED },
        });

        await tx.reservationStatusHistory.create({
          data: {
            reservationId: r.id,
            fromStatus: ReservationState.PENDING_PAYMENT,
            toStatus: ReservationState.EXPIRED,
            reason: 'PAYMENT_HOLD_TIMEOUT_15_MINUTES_EXPIRED',
          },
        });
      });

      await this.auditService.log({
        action: AuditAction.RESERVATION_UPDATED,
        reservationId: r.id,
        details: { action: 'RESERVATION_EXPIRED_BY_TIMEOUT' },
      });

      expiredCount++;
    }

    this.logger.log(`⏰ Cron Job: ${expiredCount} adet süresi dolan PENDING_PAYMENT rezervasyonu EXPIRED yapıldı.`);
    return expiredCount;
  }

  // ─── Helpers ───
  private mapToDto(r: any): ReservationResponseDto {
    return {
      id: r.id,
      customerId: r.customerId,
      branchId: r.branchId,
      branchName: r.branch ? r.branch.name : '',
      vehicleId: r.vehicleId,
      startTime: r.startTime,
      endTime: r.endTime,
      state: r.state,
      expiresAt: r.expiresAt,
      priceSnapshot: r.priceSnapshot
        ? {
            segmentName: r.priceSnapshot.segmentName,
            bodyTypeName: r.priceSnapshot.bodyTypeName,
            fuelTypeName: r.priceSnapshot.fuelTypeName,
            transmissionTypeName: r.priceSnapshot.transmissionTypeName,
            dailyPrice: Number(r.priceSnapshot.dailyPrice),
            totalDays: r.priceSnapshot.totalDays,
            totalAmount: Number(r.priceSnapshot.totalAmount),
            currency: r.priceSnapshot.currency,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // ─── Admin Paginated Reservations List ───
  async getAdminReservationsPaginated(
    query: AdminReservationQueryDto,
  ): Promise<PaginatedResponseDto<ReservationResponseDto>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.state) where.state = query.state;
    if (query.customerId) where.customerId = query.customerId;
    if (query.startDate) where.startTime = { gte: new Date(query.startDate) };
    if (query.endDate) {
      where.endTime = {
        ...(where.endTime || {}),
        lte: new Date(query.endDate),
      };
    }

    const [total, reservations] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        include: {
          branch: true,
          priceSnapshot: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    return {
      data: reservations.map((r) => this.mapToDto(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ─── Admin Paginated Change Requests List ───
  async getAdminChangeRequestsPaginated(
    query: AdminChangeRequestQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.reservationId) where.reservationId = query.reservationId;

    const [total, changeRequests] = await Promise.all([
      this.prisma.reservationChangeRequest.count({ where }),
      this.prisma.reservationChangeRequest.findMany({
        where,
        include: {
          reservation: {
            include: {
              customer: { select: { id: true, email: true, phone: true } },
              branch: true,
              priceSnapshot: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

    return {
      data: changeRequests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
