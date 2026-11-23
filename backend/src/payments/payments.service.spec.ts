import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, PaymentType, ReservationState, UserRole } from '@prisma/client';

describe('PaymentsService - Unit Tests', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockNotification: any;

  beforeEach(() => {
    mockPrisma = {
      payment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      reservation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      reservationStatusHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockNotification = {
      sendSms: jest.fn().mockResolvedValue(true),
      sendEmail: jest.fn().mockResolvedValue(true),
    };

    service = new PaymentsService(mockPrisma, mockAudit, mockNotification);
  });

  describe('processPayment - Idempotency & Error Handling', () => {
    it('Mükerrer İstek (Idempotency): Aynı idempotencyKey ile tekrar çağrıldığında yeni ödeme açmadan mevcut kaydı dönmelidir', async () => {
      const existingPayment = {
        id: 'pay-123',
        reservationId: 'res-1',
        userId: 'user-1',
        amount: { toNumber: () => 3500 },
        currency: 'TRY',
        type: PaymentType.CHARGE,
        status: PaymentStatus.SUCCESS,
        idempotencyKey: 'idemp-key-abc',
        providerRef: 'sim_success_123',
        createdAt: new Date(),
      };

      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const result = await service.processPayment('user-1', {
        reservationId: 'res-1',
        idempotencyKey: 'idemp-key-abc',
      });

      expect(result.id).toBe('pay-123');
      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPrisma.reservation.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('Rezervasyon bulunamadığında NotFoundException fırlatmalıdır', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        service.processPayment('user-1', {
          reservationId: 'res-unknown',
          idempotencyKey: 'key-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Başka müşterinin rezervasyonuna ödeme yapılmak istendiğinde ForbiddenException fırlatmalıdır', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        customerId: 'different-user',
        state: ReservationState.PENDING_PAYMENT,
      });

      await expect(
        service.processPayment('user-1', {
          reservationId: 'res-1',
          idempotencyKey: 'key-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Rezervasyon PENDING_PAYMENT dışında bir durumda ise BadRequestException fırlatmalıdır', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        customerId: 'user-1',
        state: ReservationState.CONFIRMED,
      });

      await expect(
        service.processPayment('user-1', {
          reservationId: 'res-1',
          idempotencyKey: 'key-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('15 dakikalık ödeme blokesi dolmuşsa rezervasyonu EXPIRED yapıp BadRequestException fırlatmalıdır', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        customerId: 'user-1',
        state: ReservationState.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() - 60000), // 1 dakika önce süresi dolmuş
      });

      await expect(
        service.processPayment('user-1', {
          reservationId: 'res-1',
          idempotencyKey: 'key-1',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { state: ReservationState.EXPIRED },
      });
    });
  });

  describe('processPayment - Başarılı ve Başarısız Ödeme Senaryoları', () => {
    it('Başarılı Ödeme: Rezervasyonu CONFIRMED yapar, expiresAt temizler, geçmiş kaydı ekler ve bildirim gönderir', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-uuid-1',
        customerId: 'user-1',
        state: ReservationState.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 600000), // 10 dk geçerli
        priceSnapshot: { totalAmount: 4800 },
        customer: { phone: '+905551112233', email: 'musteri@example.com' },
      });

      const createdPayment = {
        id: 'pay-uuid-success',
        reservationId: 'res-uuid-1',
        userId: 'user-1',
        amount: 4800,
        currency: 'TRY',
        type: PaymentType.CHARGE,
        status: PaymentStatus.SUCCESS,
        idempotencyKey: 'key-success-123',
        providerRef: 'sim_success_123',
        createdAt: new Date(),
      };
      mockPrisma.payment.create.mockResolvedValue(createdPayment);

      const result = await service.processPayment('user-1', {
        reservationId: 'res-uuid-1',
        idempotencyKey: 'key-success-123',
      });

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-uuid-1' },
        data: { state: ReservationState.CONFIRMED, expiresAt: null },
      });
      expect(mockPrisma.reservationStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reservationId: 'res-uuid-1',
          fromStatus: ReservationState.PENDING_PAYMENT,
          toStatus: ReservationState.CONFIRMED,
        }),
      });
      expect(mockNotification.sendSms).toHaveBeenCalled();
      expect(mockNotification.sendEmail).toHaveBeenCalled();
    });

    it('Simüle Başarısız Ödeme: Rezervasyonu PAYMENT_FAILED yapar ve FAILED ödeme kaydeder', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-uuid-fail',
        customerId: 'user-1',
        state: ReservationState.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 600000),
        priceSnapshot: { totalAmount: 3200 },
        customer: { phone: '+905551112233', email: 'musteri@example.com' },
      });

      const failedPayment = {
        id: 'pay-uuid-failed',
        reservationId: 'res-uuid-fail',
        userId: 'user-1',
        amount: 3200,
        currency: 'TRY',
        type: PaymentType.CHARGE,
        status: PaymentStatus.FAILED,
        idempotencyKey: 'key-fail-123',
        providerRef: 'sim_fail_123',
        createdAt: new Date(),
      };
      mockPrisma.payment.create.mockResolvedValue(failedPayment);

      const result = await service.processPayment('user-1', {
        reservationId: 'res-uuid-fail',
        idempotencyKey: 'key-fail-123',
        simulateFailure: true,
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-uuid-fail' },
        data: { state: ReservationState.PAYMENT_FAILED },
      });
      expect(mockPrisma.reservationStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toStatus: ReservationState.PAYMENT_FAILED,
        }),
      });
    });
  });

  describe('reconcileLatePayment - Late Payment Reconciliation & Advisory Lock Tests', () => {
    it('Mükerrer Uzlaştırma: Aynı idempotencyKey ile tekrar çağrıldığında mevcut kaydı dönmelidir', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'existing-payment-id',
        reservationId: 'res-1',
        amount: 2500,
        currency: 'TRY',
        type: PaymentType.CHARGE,
        status: PaymentStatus.SUCCESS,
        idempotencyKey: 'idemp-late-1',
        providerRef: 'prov-late-1',
        createdAt: new Date(),
      });

      const res = await service.reconcileLatePayment('user-1', UserRole.CUSTOMER, {
        reservationId: 'res-1',
        providerRef: 'prov-late-1',
        idempotencyKey: 'idemp-late-1',
      });

      expect(res.success).toBe(true);
      expect(res.reconciledStatus).toBe('CONFIRMED');
      expect(res.payment.id).toBe('existing-payment-id');
    });
  });
});
