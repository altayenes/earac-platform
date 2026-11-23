import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

describe('AuditService - Sanitizer & Pagination Unit Tests', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      auditLog: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'log-1', ...args.data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('Hassas alanları (password, token, nationalId, secret) maskelemelidir', async () => {
    const rawDetails = {
      userEmail: 'test@example.com',
      password: 'SuperSecretPassword123!',
      passwordHash: '$argon2id$v=19$m=65536...',
      token: 'jwt-access-token-xyz',
      refreshToken: 'jwt-refresh-token-abc',
      nationalId: '12345678901',
      nationalIdEncrypted: 'enc_hex_value',
      cvv: '999',
      cardNumber: '4543600000000001',
      nested: {
        secretKey: 'my-secret',
        normalField: 'ok',
      },
    };

    await service.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: 'user-1',
      details: rawDetails,
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const createdData = mockPrisma.auditLog.create.mock.calls[0][0].data;

    expect(createdData.details.userEmail).toBe('test@example.com');
    expect(createdData.details.password).toBe('***MASKED***');
    expect(createdData.details.passwordHash).toBe('***MASKED***');
    expect(createdData.details.token).toBe('***MASKED***');
    expect(createdData.details.refreshToken).toBe('***MASKED***');
    expect(createdData.details.nationalId).toBe('***MASKED***');
    expect(createdData.details.nationalIdEncrypted).toBe('***MASKED***');
    expect(createdData.details.cvv).toBe('***MASKED***');
    expect(createdData.details.cardNumber).toBe('***MASKED***');
    expect(createdData.details.nested.secretKey).toBe('***MASKED***');
    expect(createdData.details.nested.normalField).toBe('ok');
  });

  it('getPaginatedLogs standart { data, meta } zarfında dönmelidir', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(15);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'log-1', action: AuditAction.USER_CREATED },
    ]);

    const result = await service.getPaginatedLogs({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({
      total: 15,
      page: 1,
      limit: 10,
      totalPages: 2,
    });
  });
});
