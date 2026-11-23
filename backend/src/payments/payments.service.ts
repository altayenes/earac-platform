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
import { NotificationService } from '../notification/notification.service';
import {
  AuditAction,
  PaymentStatus,
  PaymentType,
  ReservationState,
  UserRole,
  VehicleState,
} from '@prisma/client';
import {
  ProcessPaymentDto,
  PaymentResponseDto,
  ReconcileLatePaymentDto,
} from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async processPayment(
    userId: string,
    dto: ProcessPaymentDto,
  ): Promise<PaymentResponseDto> {
    // 1. Idempotency Check: prevent duplicate charges
    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey.trim() },
    });

    if (existingPayment) {
      this.logger.log(
        `Idempotent duplicate request intercepted for key: ${dto.idempotencyKey}`,
      );
      return this.mapToDto(existingPayment);
    }

    // 2. Reservation Validation
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        priceSnapshot: true,
        customer: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Ödemesi yapılacak rezervasyon bulunamadı');
    }

    if (reservation.customerId !== userId) {
      throw new ForbiddenException('Yalnızca kendi rezervasyonunuz için ödeme yapabilirsiniz');
    }

    if (reservation.state !== ReservationState.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Bu rezervasyon ödeme aşamasında değildir (Mevcut durum: ${reservation.state})`,
      );
    }

    const now = new Date();
    if (reservation.expiresAt && reservation.expiresAt < now) {
      // Mark as expired
      await this.prisma.reservation.update({
        where: { id: reservation.id },
        data: { state: ReservationState.EXPIRED },
      });
      throw new BadRequestException(
        '15 dakikalık ödeme blokesi süresi dolmuştur. Lütfen yeni bir rezervasyon oluşturunuz.',
      );
    }

    const amount = reservation.priceSnapshot?.totalAmount || 0;

    // 3. Simulated Payment Provider Execution
    if (dto.simulateFailure) {
      // Failure branch
      const failedPayment = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            reservationId: reservation.id,
            userId,
            amount,
            currency: 'TRY',
            type: PaymentType.CHARGE,
            status: PaymentStatus.FAILED,
            idempotencyKey: dto.idempotencyKey.trim(),
            providerRef: `sim_fail_${Date.now()}`,
          },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { state: ReservationState.PAYMENT_FAILED },
        });

        await tx.reservationStatusHistory.create({
          data: {
            reservationId: reservation.id,
            fromStatus: ReservationState.PENDING_PAYMENT,
            toStatus: ReservationState.PAYMENT_FAILED,
            changedById: userId,
            reason: 'SIMULATED_PAYMENT_FAILURE',
          },
        });

        return payment;
      });

      return this.mapToDto(failedPayment);
    }

    // Success branch
    const successfulPayment = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          reservationId: reservation.id,
          userId,
          amount,
          currency: 'TRY',
          type: PaymentType.CHARGE,
          status: PaymentStatus.SUCCESS,
          idempotencyKey: dto.idempotencyKey.trim(),
          providerRef: `sim_success_${Date.now()}`,
        },
      });

      // Atomically mark confirmed and wipe expiry timer
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          state: ReservationState.CONFIRMED,
          expiresAt: null,
        },
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          fromStatus: ReservationState.PENDING_PAYMENT,
          toStatus: ReservationState.CONFIRMED,
          changedById: userId,
          reason: 'PAYMENT_RECEIVED_CONFIRMED',
        },
      });

      return payment;
    });

    // 4. Dispatch Sandbox Notifications
    const shortId = reservation.id.slice(0, 8).toUpperCase();
    await this.notificationService.sendSms(
      reservation.customer.phone,
      `Sayın Müşterimiz, ${Number(amount)} TRY tutarındaki ödemeniz alınmış ve #${shortId} nolu rezervasyonunuz ONAYLANMIŞTIR.`,
    );

    await this.notificationService.sendEmail(
      reservation.customer.email,
      `Rezervasyonunuz Onaylandı (#${shortId})`,
      `Sayın Müşterimiz, ${Number(amount)} TRY tutarındaki kiralama bedeli tahsil edilmiş olup #${shortId} nolu rezervasyonunuz kesinleşmiştir. İyi yolculuklar dileriz.`,
    );

    await this.auditService.log({
      action: AuditAction.RESERVATION_UPDATED,
      performedByUserId: userId,
      reservationId: reservation.id,
      details: {
        action: 'PAYMENT_CONFIRMED',
        amount: Number(amount),
        paymentId: successfulPayment.id,
      },
    });

    return this.mapToDto(successfulPayment);
  }

  async reconcileLatePayment(
    userId: string,
    userRole: UserRole,
    dto: ReconcileLatePaymentDto,
  ) {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey.trim() },
    });
    if (existingPayment) {
      return {
        success: true,
        reconciledStatus: existingPayment.type === PaymentType.CHARGE ? 'CONFIRMED' : 'REFUNDED',
        payment: this.mapToDto(existingPayment),
      };
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        priceSnapshot: true,
        customer: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Uzlaştırılacak rezervasyon bulunamadı');
    }

    if (userRole === UserRole.CUSTOMER && reservation.customerId !== userId) {
      throw new ForbiddenException('Bu rezervasyon üzerinde uzlaştırma yetkiniz yoktur');
    }

    if (!reservation.priceSnapshot) {
      throw new BadRequestException('Rezervasyon fiyat bilgisi eksik');
    }

    const amount = reservation.priceSnapshot.totalAmount;
    const snap = reservation.priceSnapshot;

    // Turnaround Buffer (2 hours)
    const bufferReturnDate = new Date(reservation.endTime.getTime() + 2 * 60 * 60 * 1000);
    const bufferPickupDate = new Date(reservation.startTime.getTime() - 2 * 60 * 60 * 1000);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const lockKey = `capacity_${reservation.branchId}_${snap.segmentName}_${snap.bodyTypeName}_${snap.fuelTypeId}_${snap.transmissionTypeId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // 1. Total available operational vehicles
      const totalVehicles = await tx.vehicle.count({
        where: {
          branchId: reservation.branchId,
          fuelTypeId: snap.fuelTypeId || undefined,
          transmissionId: snap.transmissionTypeId || undefined,
          segment: { name: snap.segmentName },
          bodyType: { name: snap.bodyTypeName },
          isActive: true,
          state: { notIn: [VehicleState.INACTIVE, VehicleState.DAMAGED_OUT_OF_SERVICE] },
        },
      });

      // 2. Overlapping active/confirmed reservations
      const overlappingCount = await tx.reservation.count({
        where: {
          id: { not: reservation.id },
          branchId: reservation.branchId,
          startTime: { lt: bufferReturnDate },
          endTime: { gt: bufferPickupDate },
          priceSnapshot: {
            segmentName: snap.segmentName,
            bodyTypeName: snap.bodyTypeName,
            fuelTypeId: snap.fuelTypeId,
            transmissionTypeId: snap.transmissionTypeId,
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

      const hasCapacity = totalVehicles > 0 && overlappingCount < totalVehicles;

      if (hasCapacity) {
        // CAPACITY AVAILABLE: Confirm reservation and record charge
        const payment = await tx.payment.create({
          data: {
            reservationId: reservation.id,
            userId: reservation.customerId,
            amount,
            currency: snap.currency || 'TRY',
            type: PaymentType.CHARGE,
            status: PaymentStatus.SUCCESS,
            idempotencyKey: dto.idempotencyKey.trim(),
            providerRef: dto.providerRef,
          },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            state: ReservationState.CONFIRMED,
            expiresAt: null,
          },
        });

        await tx.reservationStatusHistory.create({
          data: {
            reservationId: reservation.id,
            fromStatus: reservation.state,
            toStatus: ReservationState.CONFIRMED,
            changedById: userId,
            reason: 'PAYMENT_RECONCILED',
          },
        });

        return { status: 'CONFIRMED', payment };
      } else {
        // CAPACITY FULL: Auto REFUND and keep cancelled
        const refundPayment = await tx.payment.create({
          data: {
            reservationId: reservation.id,
            userId: reservation.customerId,
            amount,
            currency: snap.currency || 'TRY',
            type: PaymentType.REFUND,
            status: PaymentStatus.SUCCESS,
            idempotencyKey: dto.idempotencyKey.trim(),
            providerRef: `refund_${dto.providerRef}`,
          },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            state: ReservationState.CANCELLED,
            expiresAt: null,
          },
        });

        await tx.reservationStatusHistory.create({
          data: {
            reservationId: reservation.id,
            fromStatus: reservation.state,
            toStatus: ReservationState.CANCELLED,
            changedById: userId,
            reason: 'LATE_PAYMENT_CAPACITY_FULL_AUTOMATIC_REFUND',
          },
        });

        return { status: 'REFUNDED', payment: refundPayment };
      }
    });

    const shortId = reservation.id.slice(0, 8).toUpperCase();
    if (result.status === 'CONFIRMED') {
      await this.notificationService.sendSms(
        reservation.customer.phone,
        `Sayın Müşterimiz, #${shortId} nolu rezervasyonunuza ait geç gelen ödemeniz uzlaştırılmış ve kapasite tahsis edilerek ONAYLANMIŞTIR.`,
      );
      await this.auditService.log({
        action: AuditAction.RESERVATION_UPDATED,
        performedByUserId: userId,
        reservationId: reservation.id,
        details: { action: 'LATE_PAYMENT_RECONCILED_CONFIRMED', paymentId: result.payment.id },
      });
    } else {
      await this.notificationService.sendSms(
        reservation.customer.phone,
        `Sayın Müşterimiz, #${shortId} nolu rezervasyonunuzda filo kapasitesi dolduğu için tahsil edilen bedel kartınıza tam İADE EDİLMİŞTİR.`,
      );
      await this.auditService.log({
        action: AuditAction.RESERVATION_CANCELLED,
        performedByUserId: userId,
        reservationId: reservation.id,
        details: { action: 'LATE_PAYMENT_CAPACITY_FULL_REFUND', paymentId: result.payment.id },
      });
    }

    return {
      success: true,
      reconciledStatus: result.status,
      payment: this.mapToDto(result.payment),
    };
  }

  async getPaymentsByReservation(
    reservationId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<PaymentResponseDto[]> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (userRole === UserRole.CUSTOMER && reservation.customerId !== userId) {
      throw new ForbiddenException('Bu ödemeleri görüntüleme yetkiniz yok');
    }

    const payments = await this.prisma.payment.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.mapToDto(p));
  }

  private mapToDto(p: any): PaymentResponseDto {
    return {
      id: p.id,
      reservationId: p.reservationId,
      userId: p.userId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      type: p.type,
      idempotencyKey: p.idempotencyKey,
      providerRef: p.providerRef,
      createdAt: p.createdAt,
    };
  }
}
