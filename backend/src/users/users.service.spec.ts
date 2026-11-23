import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('UsersService - Profile Corrections & Verification Unit Tests', () => {
  let service: UsersService;
  let mockPrisma: any;
  let mockCrypto: any;
  let mockAudit: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customerProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      smsVerificationCode: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      profileCorrectionRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    mockCrypto = {
      hashNationalId: jest.fn().mockReturnValue('mock-hash-val'),
      encryptNationalId: jest.fn().mockReturnValue('mock-enc-val'),
      decryptNationalId: jest.fn().mockReturnValue('12345678901'),
      maskNationalId: jest.fn().mockReturnValue('123*****901'),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('createProfileCorrectionRequest', () => {
    it('Bekleyen açık bir talep varsa ConflictException fırlatmalıdır', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        customerProfile: { id: 'prof-1' },
      });
      mockPrisma.profileCorrectionRequest.findFirst.mockResolvedValue({
        id: 'req-pending',
        status: 'PENDING',
      });

      await expect(
        service.createProfileCorrectionRequest('user-1', {
          requestedFirstName: 'Ali',
          reason: 'İsim değişikliği',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Geçerli talep oluşturulduğunda PENDING durumunda kaydetmeli ve bildirim logu atmalıdır', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        customerProfile: { id: 'prof-1' },
      });
      mockPrisma.profileCorrectionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.profileCorrectionRequest.create.mockResolvedValue({
        id: 'req-new',
        userId: 'user-1',
        requestedFirstName: 'Ahmet',
        reason: 'Nüfus kaydı düzeltmesi',
        status: 'PENDING',
      });

      const res = await service.createProfileCorrectionRequest('user-1', {
        requestedFirstName: 'Ahmet',
        reason: 'Nüfus kaydı düzeltmesi',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.profileCorrectionRequest.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalled();
    });
  });

  describe('reviewProfileCorrection', () => {
    it('SUPER_ADMIN reddettiğinde REJECTED durumuna almalıdır', async () => {
      mockPrisma.profileCorrectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        userId: 'user-1',
        user: { customerProfile: { id: 'prof-1' } },
      });

      const res = await service.reviewProfileCorrection('req-1', 'admin-1', {
        status: 'REJECTED',
        reviewNote: 'Belgeler yetersiz',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.profileCorrectionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'REJECTED', reviewedBy: 'admin-1', reviewNote: 'Belgeler yetersiz' },
      });
    });

    it('SUPER_ADMIN onayladığında CustomerProfile atomik olarak güncellenmelidir', async () => {
      mockPrisma.profileCorrectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        userId: 'user-1',
        requestedFirstName: 'Mehmet',
        requestedLastName: 'Demir',
        user: {
          customerProfile: {
            id: 'prof-1',
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            nationalIdHash: 'old-hash',
            nationalIdEncrypted: 'old-enc',
          },
        },
      });

      const res = await service.reviewProfileCorrection('req-1', 'admin-1', {
        status: 'APPROVED',
        reviewNote: 'Resmi mahkeme kararı teyit edildi',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.customerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prof-1' },
          data: expect.objectContaining({
            firstName: 'Mehmet',
            lastName: 'Demir',
          }),
        }),
      );
    });
  });

  describe('getPaginatedProfileCorrections (SEC-02 Data Leak Prevention)', () => {
    it('ham nationalIdHash/Encrypted alanlarını sızdırmamalı ve requestedNationalId maskeli olmalıdır', async () => {
      mockPrisma.profileCorrectionRequest.count.mockResolvedValue(1);
      mockPrisma.profileCorrectionRequest.findMany.mockResolvedValue([
        {
          id: 'req-1',
          userId: 'user-1',
          requestedNationalId: '12345678901',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            phone: '+905551234567',
            customerProfile: {
              id: 'prof-1',
              userId: 'user-1',
              firstName: 'Ahmet',
              lastName: 'Yılmaz',
              birthDate: new Date('1990-01-01'),
              licenseDate: new Date('2010-01-01'),
              nationalIdHash: 'secret-hash-123',
              nationalIdEncrypted: 'secret-enc-456',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
      ]);

      const res = await service.getPaginatedProfileCorrections({});
      expect(res.data).toHaveLength(1);
      const item = res.data[0];
      // Requested national id must be masked
      expect(item.requestedNationalId).toBe('123*****901');
      // Raw hash and encrypted fields must not be present in user.customerProfile
      expect((item.user.customerProfile as any).nationalIdHash).toBeUndefined();
      expect((item.user.customerProfile as any).nationalIdEncrypted).toBeUndefined();
      expect(item.user.customerProfile.maskedNationalId).toBe('123*****901');
    });
  });
});
