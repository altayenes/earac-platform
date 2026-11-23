import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VehicleState } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('VehiclesService - State Machine & Privacy Tests', () => {
  let service: VehiclesService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      vehicle: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    mockAudit = { log: jest.fn() };
    service = new VehiclesService(mockPrisma as PrismaService, mockAudit as AuditService);
  });

  describe('Vehicle State Machine Transitions', () => {
    it('AVAILABLE -> RENTED geçişi GEÇERLİDİR', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'v1',
        state: VehicleState.AVAILABLE,
        isActive: true,
        model: { name: 'Corolla', brand: { name: 'Toyota' } },
        segment: { name: 'Economic' },
        bodyType: { name: 'Sedan' },
        fuelType: { name: 'Benzin' },
        transmission: { name: 'Otomatik' },
        branch: { name: 'İstanbul' },
      });
      mockPrisma.vehicle.update.mockResolvedValue({
        id: 'v1',
        state: VehicleState.RENTED,
        isActive: true,
        model: { name: 'Corolla', brand: { name: 'Toyota' } },
        segment: { name: 'Economic' },
        bodyType: { name: 'Sedan' },
        fuelType: { name: 'Benzin' },
        transmission: { name: 'Otomatik' },
        branch: { name: 'İstanbul' },
      });

      const updated = await service.updateVehicleState('v1', { state: VehicleState.RENTED });
      expect(updated.state).toBe(VehicleState.RENTED);
    });

    it('MAINTENANCE -> INACTIVE geçişi GEÇERLİDİR (Kullanıcı tarafından onaylanan geçiş)', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'v2',
        state: VehicleState.MAINTENANCE,
        isActive: true,
        model: { name: 'Passat', brand: { name: 'Volkswagen' } },
        segment: { name: 'Medium' },
        bodyType: { name: 'Sedan' },
        fuelType: { name: 'Dizel' },
        transmission: { name: 'Otomatik' },
        branch: { name: 'İstanbul' },
      });
      mockPrisma.vehicle.update.mockResolvedValue({
        id: 'v2',
        state: VehicleState.INACTIVE,
        isActive: true,
        model: { name: 'Passat', brand: { name: 'Volkswagen' } },
        segment: { name: 'Medium' },
        bodyType: { name: 'Sedan' },
        fuelType: { name: 'Dizel' },
        transmission: { name: 'Otomatik' },
        branch: { name: 'İstanbul' },
      });

      const updated = await service.updateVehicleState('v2', { state: VehicleState.INACTIVE });
      expect(updated.state).toBe(VehicleState.INACTIVE);
    });

    it('RENTED -> MAINTENANCE geçişi GEÇERSİZDİR (Önce iade/hasar kaydı alınmalıdır)', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: 'v3',
        state: VehicleState.RENTED,
        isActive: true,
        model: { name: 'Passat', brand: { name: 'Volkswagen' } },
        segment: { name: 'Medium' },
        bodyType: { name: 'Sedan' },
        fuelType: { name: 'Dizel' },
        transmission: { name: 'Otomatik' },
        branch: { name: 'İstanbul' },
      });

      await expect(
        service.updateVehicleState('v3', { state: VehicleState.MAINTENANCE }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Privacy Rule: Public Vehicle DTO should NEVER expose vin or licensePlate', () => {
    it('mapToPublicDto hides vin and licensePlate', () => {
      const fullVehicleRecord = {
        id: 'v-secret-id',
        vin: 'SECRET_VIN_1234567',
        licensePlate: '34 PRIVATE 99',
        mileage: 15000,
        isActive: true,
        state: VehicleState.AVAILABLE,
        year: 2024,
        branchId: 'b1',
        branch: { name: 'İstanbul Havalimanı' },
        model: { name: 'Corolla', brand: { name: 'Toyota' } },
        segment: { name: 'Economic' },
        bodyType: { name: 'Sedan' },
        fuelType: { name: 'Benzin' },
        transmission: { name: 'Otomatik' },
      };

      const publicDto = service.mapToPublicDto(fullVehicleRecord);
      expect((publicDto as any).vin).toBeUndefined();
      expect((publicDto as any).licensePlate).toBeUndefined();
      expect((publicDto as any).mileage).toBeUndefined();
      expect(publicDto.brandName).toBe('Toyota');
      expect(publicDto.modelName).toBe('Corolla');
    });
  });
});
