import { Test, TestingModule } from '@nestjs/testing';
import { HandoverController } from './handover.controller';
import { HandoverService } from './handover.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('HandoverController - BFLA Security Tests (SEC-01)', () => {
  let controller: HandoverController;
  let mockHandoverService: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockHandoverService = {
      getMatchingAvailableVehicles: jest.fn().mockResolvedValue([]),
      getEligibleVehiclesPaginated: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      deliverVehicle: jest.fn().mockResolvedValue({ id: 'handover-1' }),
      returnVehicle: jest.fn().mockResolvedValue({ id: 'return-1' }),
      markNoShow: jest.fn().mockResolvedValue({ success: true }),
    };

    mockPrisma = {
      staffPermission: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HandoverController],
      providers: [
        { provide: HandoverService, useValue: mockHandoverService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { getOrThrow: () => 'test' } },
      ],
    }).compile();

    controller = module.get<HandoverController>(HandoverController);
  });

  it('SUPER_ADMIN her uç noktaya izinsiz takılmadan erişebilmelidir', async () => {
    const adminUser = { sub: 'admin-1', role: UserRole.SUPER_ADMIN };
    await expect(
      controller.getAvailableVehicles(adminUser, 'res-1'),
    ).resolves.toEqual([]);
    expect(mockPrisma.staffPermission.findUnique).not.toHaveBeenCalled();
  });

  it('canManageReservations yetkisi OLMAYAN STAFF ForbiddenException almalıdır', async () => {
    const staffUser = { sub: 'staff-1', role: UserRole.STAFF };
    mockPrisma.staffPermission.findUnique.mockResolvedValue({
      canManageReservations: false,
    });

    await expect(
      controller.getAvailableVehicles(staffUser, 'res-1'),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      controller.getEligibleVehicles(staffUser, 'res-1', {}),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      controller.deliverVehicle(staffUser, {
        reservationId: 'res-1',
        vehicleId: 'veh-1',
        mileageOut: 10000,
        fuelLevelOut: 100,
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      controller.returnVehicle(staffUser, {
        reservationId: 'res-1',
        mileageIn: 10500,
        fuelLevelIn: 90,
        hasDamage: false,
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      controller.markNoShow(staffUser, 'res-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('canManageReservations yetkisine SAHİP STAFF başarılı olmalıdır', async () => {
    const staffUser = { sub: 'staff-1', role: UserRole.STAFF };
    mockPrisma.staffPermission.findUnique.mockResolvedValue({
      canManageReservations: true,
    });

    await expect(
      controller.getAvailableVehicles(staffUser, 'res-1'),
    ).resolves.toEqual([]);
    expect(mockHandoverService.getMatchingAvailableVehicles).toHaveBeenCalledWith('res-1');
  });
});
