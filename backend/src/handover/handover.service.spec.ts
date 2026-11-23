import { HandoverService } from './handover.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ReservationState,
  VehicleState,
  UserRole,
} from '@prisma/client';

describe('HandoverService - Unit Tests', () => {
  let service: HandoverService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      reservation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      vehicle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      handoverRecord: {
        create: jest.fn(),
      },
      returnRecord: {
        create: jest.fn(),
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

    service = new HandoverService(mockPrisma, mockAudit);
  });

  describe('deliverVehicle (Araç Teslimatı)', () => {
    const staffUser = { id: 'staff-1', role: UserRole.STAFF };
    const superAdminUser = { id: 'admin-1', role: UserRole.SUPER_ADMIN };

    it('Yalnızca CONFIRMED durumundaki rezervasyona araç teslim edilebilir', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.PENDING_PAYMENT,
      });

      await expect(
        service.deliverVehicle(staffUser, {
          reservationId: 'res-1',
          vehicleId: 'veh-1',
          mileageOut: 15000,
          fuelLevelOut: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Müsait (AVAILABLE) olmayan araç teslim edilemez', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.CONFIRMED,
        branchId: 'branch-1',
        priceSnapshot: { segmentName: 'Economic', bodyTypeName: 'Sedan' },
      });

      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'veh-1',
        state: VehicleState.MAINTENANCE, // Bakımda
        isActive: true,
        branchId: 'branch-1',
        segment: { name: 'Economic' },
        bodyType: { name: 'Sedan' },
      });

      await expect(
        service.deliverVehicle(staffUser, {
          reservationId: 'res-1',
          vehicleId: 'veh-1',
          mileageOut: 15000,
          fuelLevelOut: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Farklı şubedeki araç teslim edilemez', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.CONFIRMED,
        branchId: 'branch-ist',
        priceSnapshot: { segmentName: 'Economic', bodyTypeName: 'Sedan' },
      });

      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'veh-1',
        state: VehicleState.AVAILABLE,
        isActive: true,
        branchId: 'branch-ank', // Başka şube
        segment: { name: 'Economic' },
        bodyType: { name: 'Sedan' },
      });

      await expect(
        service.deliverVehicle(staffUser, {
          reservationId: 'res-1',
          vehicleId: 'veh-1',
          mileageOut: 15000,
          fuelLevelOut: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Tam Eşleşen Araç Teslimi: Rezervasyonu ACTIVE, aracı RENTED yapar ve HandoverRecord oluşturur', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.CONFIRMED,
        branchId: 'branch-1',
        priceSnapshot: { segmentName: 'Economic', bodyTypeName: 'Sedan' },
        customer: { id: 'cust-1', phone: '+905551112233' },
      });

      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'veh-1',
        state: VehicleState.AVAILABLE,
        isActive: true,
        branchId: 'branch-1',
        licensePlate: '34ABC01',
        segment: { name: 'Economic' },
        bodyType: { name: 'Sedan' },
      });

      const mockHandover = {
        id: 'hand-1',
        reservationId: 'res-1',
        vehicleId: 'veh-1',
        mileageOut: 20000,
        fuelLevelOut: 100,
        isExceptionUpgrade: false,
        customerApproved: false,
      };
      mockPrisma.handoverRecord.create.mockResolvedValue(mockHandover);

      const result = await service.deliverVehicle(staffUser, {
        reservationId: 'res-1',
        vehicleId: 'veh-1',
        mileageOut: 20000,
        fuelLevelOut: 100,
      });

      expect(result.id).toBe('hand-1');
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { vehicleId: 'veh-1', state: ReservationState.ACTIVE },
      });
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'veh-1' },
        data: { state: VehicleState.RENTED, mileage: 20000 },
      });
    });

    it('İstisnai Üst/Eşdeğer Araç Ataması: Normal STAFF yapamaz, SUPER_ADMIN ve customerApproved zorunludur', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.CONFIRMED,
        branchId: 'branch-1',
        priceSnapshot: { segmentName: 'Economic', bodyTypeName: 'Sedan' },
      });

      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'veh-premium',
        state: VehicleState.AVAILABLE,
        isActive: true,
        branchId: 'branch-1',
        licensePlate: '34PRM99',
        segment: { name: 'Premium' }, // Üst segment!
        bodyType: { name: 'SUV' },
      });

      // 1. Normal personel denediğinde ForbiddenException
      await expect(
        service.deliverVehicle(staffUser, {
          reservationId: 'res-1',
          vehicleId: 'veh-premium',
          mileageOut: 5000,
          fuelLevelOut: 100,
          isExceptionUpgrade: true,
          customerApproved: true,
        }),
      ).rejects.toThrow(ForbiddenException);

      // 2. Müşteri onayı olmadan SUPER_ADMIN denediğinde BadRequestException
      await expect(
        service.deliverVehicle(superAdminUser, {
          reservationId: 'res-1',
          vehicleId: 'veh-premium',
          mileageOut: 5000,
          fuelLevelOut: 100,
          isExceptionUpgrade: true,
          customerApproved: false, // Müşteri onayı yok!
        }),
      ).rejects.toThrow(BadRequestException);

      // 3. SUPER_ADMIN ve müşteri onayı tam olduğunda başarıyla teslim edilir ve VEHICLE_EXCEPTION_ASSIGNED audit yazılır
      mockPrisma.handoverRecord.create.mockResolvedValue({
        id: 'hand-upgrade',
        isExceptionUpgrade: true,
      });

      const res = await service.deliverVehicle(superAdminUser, {
        reservationId: 'res-1',
        vehicleId: 'veh-premium',
        mileageOut: 5000,
        fuelLevelOut: 100,
        isExceptionUpgrade: true,
        customerApproved: true,
      });

      expect(res.isExceptionUpgrade).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.VEHICLE_EXCEPTION_ASSIGNED,
        }),
      );
    });
  });

  describe('returnVehicle (Araç İadesi ve Hasar Yönetimi)', () => {
    const staffUser = { id: 'staff-1', role: UserRole.STAFF };

    it('Yalnızca ACTIVE durumundaki rezervasyon iade alınabilir', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.CONFIRMED, // Henüz teslim alınmamış
      });

      await expect(
        service.returnVehicle(staffUser, {
          reservationId: 'res-1',
          mileageIn: 21000,
          fuelLevelIn: 100,
          hasDamage: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Kilometre Doğrulaması: İade KM teslimat KM den daha düşükse reddedilmelidir', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.ACTIVE,
        vehicleId: 'veh-1',
        handoverRecord: { mileageOut: 20000 },
        vehicle: { id: 'veh-1' },
        endTime: new Date('2026-12-04T12:00:00Z'),
      });

      await expect(
        service.returnVehicle(staffUser, {
          reservationId: 'res-1',
          mileageIn: 19500, // Teslimat 20.000 idi, 19.500 olamaz!
          fuelLevelIn: 100,
          hasDamage: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Hasarsız İade: Rezervasyonu COMPLETED yapar, aracı AVAILABLE duruma getirir ve güncel KM kaydeder', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.ACTIVE,
        vehicleId: 'veh-1',
        handoverRecord: { mileageOut: 20000 },
        vehicle: { id: 'veh-1' },
        endTime: new Date('2026-12-04T12:00:00Z'),
      });

      const mockReturn = {
        id: 'ret-1',
        reservationId: 'res-1',
        vehicleId: 'veh-1',
        mileageIn: 20500,
        fuelLevelIn: 95,
        hasDamage: false,
      };
      mockPrisma.returnRecord.create.mockResolvedValue(mockReturn);

      const result = await service.returnVehicle(staffUser, {
        reservationId: 'res-1',
        mileageIn: 20500,
        fuelLevelIn: 95,
        hasDamage: false,
      });

      expect(result.id).toBe('ret-1');
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { state: ReservationState.COMPLETED },
      });
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'veh-1' },
        data: { state: VehicleState.AVAILABLE, mileage: 20500 },
      });
    });

    it('Hasarlı İade: Rezervasyonu COMPLETED yapar, aracı otomatik DAMAGED_OUT_OF_SERVICE yapar ve hasar denetim kaydı oluşturur', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        state: ReservationState.ACTIVE,
        vehicleId: 'veh-1',
        handoverRecord: { mileageOut: 20000 },
        vehicle: { id: 'veh-1' },
        endTime: new Date('2026-12-04T12:00:00Z'),
      });

      const mockReturn = {
        id: 'ret-damaged',
        reservationId: 'res-1',
        vehicleId: 'veh-1',
        mileageIn: 20300,
        fuelLevelIn: 80,
        hasDamage: true,
        damageNotes: 'Ön tamponda derin çizik ve sağ far çatlak',
      };
      mockPrisma.returnRecord.create.mockResolvedValue(mockReturn);

      const result = await service.returnVehicle(staffUser, {
        reservationId: 'res-1',
        mileageIn: 20300,
        fuelLevelIn: 80,
        hasDamage: true,
        damageNotes: 'Ön tamponda derin çizik ve sağ far çatlak',
      });

      expect(result.hasDamage).toBe(true);
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'veh-1' },
        data: { state: VehicleState.DAMAGED_OUT_OF_SERVICE, mileage: 20300 },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.VEHICLE_DAMAGED_ON_RETURN,
        }),
      );
    });
  });

  describe('markNoShow (Müşteri Gelmedi İşareti)', () => {
    it('CONFIRMED rezervasyonu NO_SHOW durumuna geçirir ve AuditLog yazar', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-noshow',
        state: ReservationState.CONFIRMED,
        vehicleId: null,
      });

      mockPrisma.reservation.update.mockResolvedValue({
        id: 'res-noshow',
        state: ReservationState.NO_SHOW,
      });

      const result = await service.markNoShow(
        'res-noshow',
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RESERVATION_NO_SHOW,
        }),
      );
    });
  });
});
