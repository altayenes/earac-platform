import { ReservationsService, TURNAROUND_BUFFER_HOURS } from './reservations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  PaymentStatus,
  PaymentType,
  ReservationState,
  UserRole,
} from '@prisma/client';

describe('ReservationsService - Business Rules & Eligibility Tests', () => {
  let service: ReservationsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      reservation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      reservationStatusHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    service = new ReservationsService(mockPrisma, mockAudit);
  });

  describe('Duration in Days & Turnaround Buffer Calculation', () => {
    it('should calculate minimum 1 day for same-day or 24-hr rental', () => {
      const pickup = new Date('2026-12-01T10:00:00Z');
      const returnDate = new Date('2026-12-01T18:00:00Z'); // 8 hours
      const days = service.calculateRentalDays(pickup, returnDate);
      expect(days).toBe(1);
    });

    it('should calculate 3 days for 72-hour rental', () => {
      const pickup = new Date('2026-12-01T10:00:00Z');
      const returnDate = new Date('2026-12-04T10:00:00Z'); // 72 hours
      const days = service.calculateRentalDays(pickup, returnDate);
      expect(days).toBe(3);
    });

    it('should calculate 4 days when exceeding 72 hours by 1 hour', () => {
      const pickup = new Date('2026-12-01T10:00:00Z');
      const returnDate = new Date('2026-12-04T11:00:00Z'); // 73 hours
      const days = service.calculateRentalDays(pickup, returnDate);
      expect(days).toBe(4);
    });

    it('should enforce 2-hour turnaround buffer constant', () => {
      expect(TURNAROUND_BUFFER_HOURS).toBe(2);
    });
  });

  describe('Fixed Segment Eligibility Rules (Sabit İş Kuralları)', () => {
    const pickupDate = new Date('2026-12-01T10:00:00Z');

    const economicSegment = { name: 'Economic', minAge: 21, minLicenseYears: 2 };
    const mediumSegment = { name: 'Medium', minAge: 23, minLicenseYears: 3 };
    const premiumSegment = { name: 'Premium', minAge: 25, minLicenseYears: 5 };

    it('Economic Segment: 21 yaşında ve 2 yıllık ehliyeti olan müşteri UYGUNDUR', () => {
      const profile = {
        birthDate: new Date('2005-01-01T00:00:00Z'), // ~21.9 yaşında
        licenseDate: new Date('2024-01-01T00:00:00Z'), // ~2.9 yıllık ehliyet
      };
      const result = service.checkEligibility(profile, economicSegment, pickupDate);
      expect(result.isEligible).toBe(true);
    });

    it('Economic Segment: 20 yaşındaki müşteri yaş sınırına takılmalıdır', () => {
      const profile = {
        birthDate: new Date('2006-06-01T00:00:00Z'), // ~20.5 yaşında
        licenseDate: new Date('2024-01-01T00:00:00Z'),
      };
      const result = service.checkEligibility(profile, economicSegment, pickupDate);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('asgari yaş sınırı 21');
    });

    it('Economic Segment: 1 yıllık ehliyeti olan müşteri ehliyet sınırına takılmalıdır', () => {
      const profile = {
        birthDate: new Date('2003-01-01T00:00:00Z'), // 23 yaşında
        licenseDate: new Date('2025-11-01T00:00:00Z'), // ~1 yıllık ehliyet
      };
      const result = service.checkEligibility(profile, economicSegment, pickupDate);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('asgari ehliyet süresi 2');
    });

    it('Medium Segment: 23 yaş ve 3 yıl ehliyet şartını karşılamalıdır', () => {
      const eligibleProfile = {
        birthDate: new Date('2003-01-01T00:00:00Z'), // ~23.9 yaşında
        licenseDate: new Date('2023-01-01T00:00:00Z'), // ~3.9 yıllık ehliyet
      };
      expect(service.checkEligibility(eligibleProfile, mediumSegment, pickupDate).isEligible).toBe(true);

      const underAgeProfile = {
        birthDate: new Date('2004-05-01T00:00:00Z'), // ~22.5 yaşında
        licenseDate: new Date('2023-01-01T00:00:00Z'),
      };
      expect(service.checkEligibility(underAgeProfile, mediumSegment, pickupDate).isEligible).toBe(false);
    });

    it('Premium Segment: 25 yaş ve 5 yıl ehliyet şartını karşılamalıdır', () => {
      const eligibleProfile = {
        birthDate: new Date('2001-01-01T00:00:00Z'), // ~25.9 yaşında
        licenseDate: new Date('2021-01-01T00:00:00Z'), // ~5.9 yıllık ehliyet
      };
      expect(service.checkEligibility(eligibleProfile, premiumSegment, pickupDate).isEligible).toBe(true);

      const underLicenseProfile = {
        birthDate: new Date('2000-01-01T00:00:00Z'), // 26 yaşında
        licenseDate: new Date('2023-01-01T00:00:00Z'), // ~3.9 yıllık ehliyet
      };
      const result = service.checkEligibility(underLicenseProfile, premiumSegment, pickupDate);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('asgari ehliyet süresi 5');
    });
  });

  describe('cancelReservation (Rezervasyon İptali ve Otomatik İade)', () => {
    it('Başka kullanıcının rezervasyonu iptal edilmek istendiğinde ForbiddenException fırlatmalıdır (IDOR Koruması)', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        customerId: 'customer-owner',
        state: ReservationState.CONFIRMED,
      });

      await expect(
        service.cancelReservation('res-1', 'other-customer', UserRole.CUSTOMER, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ACTIVE (kirada/kullanımda) rezervasyon iptal edilemez, BadRequestException fırlatmalıdır', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-active',
        customerId: 'customer-1',
        state: ReservationState.ACTIVE,
      });

      await expect(
        service.cancelReservation('res-active', 'customer-1', UserRole.CUSTOMER, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('CONFIRMED rezervasyon iptalinde otomatik tam tutarlı REFUND kaydı oluşturur ve CANCELLED yapar', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-conf',
        customerId: 'cust-1',
        state: ReservationState.CONFIRMED,
        payments: [
          {
            id: 'pay-charge-1',
            type: PaymentType.CHARGE,
            status: PaymentStatus.SUCCESS,
            amount: 5400,
            currency: 'TRY',
          },
        ],
      });

      const result = await service.cancelReservation('res-conf', 'cust-1', UserRole.CUSTOMER, {
        reason: 'Uçuşum iptal oldu',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-conf' },
        data: { state: ReservationState.CANCELLED, expiresAt: null },
      });
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reservationId: 'res-conf',
          userId: 'cust-1',
          amount: 5400,
          type: PaymentType.REFUND,
          status: PaymentStatus.SUCCESS,
        }),
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RESERVATION_CANCELLED,
        }),
      );
    });
  });

  describe('Branch Operating Hours & OWASP API6 Tests', () => {
    it('Europe/Istanbul saat diliminde şube çalışma saatlerini doğru doğrulamalıdır', () => {
      const branch = {
        name: 'İstanbul Havalimanı Şubesi',
        openingTime: '08:30',
        closingTime: '20:00',
      };

      // 10:00 UTC = 13:00 Istanbul (Açık)
      const validPickup = new Date('2026-12-01T10:00:00Z');
      const validReturn = new Date('2026-12-04T12:00:00Z');
      expect(() =>
        service.validateBranchOperatingHours(branch, validPickup, validReturn),
      ).not.toThrow();

      // 22:00 UTC = 01:00 Istanbul (Kapalı)
      const invalidPickup = new Date('2026-12-01T22:00:00Z');
      expect(() =>
        service.validateBranchOperatingHours(branch, invalidPickup, validReturn),
      ).toThrow(BadRequestException);
    });
  });
});
