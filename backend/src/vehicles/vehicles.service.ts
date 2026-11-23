import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, VehicleState } from '@prisma/client';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  UpdateVehicleStateDto,
  PublicVehicleResponseDto,
  AdminVehicleResponseDto,
} from './dto/vehicle.dto';
import {
  CreateNamedEntityDto,
  CreateModelDto,
  ReferenceDataResponseDto,
  ModelResponseDto,
} from './dto/reference-data.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ─── Vehicle State Machine Valid Transitions ───
  private readonly allowedTransitions: Record<VehicleState, VehicleState[]> = {
    [VehicleState.AVAILABLE]: [
      VehicleState.RENTED,
      VehicleState.MAINTENANCE,
      VehicleState.INACTIVE,
    ],
    [VehicleState.RENTED]: [
      VehicleState.AVAILABLE,
      VehicleState.DAMAGED_OUT_OF_SERVICE,
    ],
    [VehicleState.MAINTENANCE]: [
      VehicleState.AVAILABLE,
      VehicleState.INACTIVE,
    ],
    [VehicleState.DAMAGED_OUT_OF_SERVICE]: [
      VehicleState.MAINTENANCE,
      VehicleState.INACTIVE,
    ],
    [VehicleState.INACTIVE]: [
      VehicleState.AVAILABLE,
      VehicleState.MAINTENANCE,
    ],
  };

  // ─── Public Queries (NO VIN, NO License Plate) ───
  async findPublicVehicles(filters?: {
    branchId?: string;
    segmentId?: string;
    bodyTypeId?: string;
    fuelTypeId?: string;
    transmissionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PublicVehicleResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, filters?.limit || 50));
    const safeOffset = Math.max(0, filters?.offset || 0);

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isActive: true,
        state: VehicleState.AVAILABLE,
        branchId: filters?.branchId,
        segmentId: filters?.segmentId,
        bodyTypeId: filters?.bodyTypeId,
        fuelTypeId: filters?.fuelTypeId,
        transmissionId: filters?.transmissionId,
      },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
      orderBy: [{ segmentId: 'asc' }, { modelId: 'asc' }],
      take: safeLimit,
      skip: safeOffset,
    });

    return vehicles.map((v) => this.mapToPublicDto(v));
  }

  async findPublicVehicleById(id: string): Promise<PublicVehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
    });

    if (!vehicle || !vehicle.isActive) {
      throw new NotFoundException('Araç bulunamadı');
    }

    return this.mapToPublicDto(vehicle);
  }

  // ─── Admin / Staff Queries (Includes VIN, Plate, Full Data) ───
  async findAdminVehicles(filters?: {
    branchId?: string;
    state?: VehicleState;
    onlyActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AdminVehicleResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, filters?.limit || 50));
    const safeOffset = Math.max(0, filters?.offset || 0);

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        branchId: filters?.branchId,
        state: filters?.state,
        isActive: filters?.onlyActive !== false ? true : undefined,
      },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      skip: safeOffset,
    });

    return vehicles.map((v) => this.mapToAdminDto(v));
  }

  async findAdminVehicleById(id: string): Promise<AdminVehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Araç bulunamadı');
    }

    return this.mapToAdminDto(vehicle);
  }

  // ─── Create Vehicle ───
  async createVehicle(dto: CreateVehicleDto, userId?: string): Promise<AdminVehicleResponseDto> {
    const vin = dto.vin.trim().toUpperCase();
    const licensePlate = dto.licensePlate.trim().toUpperCase();

    const existingVin = await this.prisma.vehicle.findUnique({ where: { vin } });
    if (existingVin) {
      throw new ConflictException('Bu şasi numarasına (VIN) sahip bir araç zaten kayıtlıdır');
    }

    const existingPlate = await this.prisma.vehicle.findUnique({ where: { licensePlate } });
    if (existingPlate) {
      throw new ConflictException('Bu plakaya sahip bir araç zaten kayıtlıdır');
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        vin,
        licensePlate,
        modelId: dto.modelId,
        segmentId: dto.segmentId,
        bodyTypeId: dto.bodyTypeId,
        fuelTypeId: dto.fuelTypeId,
        transmissionId: dto.transmissionId,
        branchId: dto.branchId,
        year: dto.year,
        mileage: dto.mileage ?? 0,
        state: VehicleState.AVAILABLE,
      },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.VEHICLE_CREATED,
      performedByUserId: userId,
      details: { vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, vin: vehicle.vin },
    });

    return this.mapToAdminDto(vehicle);
  }

  // ─── Update Vehicle ───
  async updateVehicle(
    id: string,
    dto: UpdateVehicleDto,
    userId?: string,
  ): Promise<AdminVehicleResponseDto> {
    await this.findAdminVehicleById(id);

    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(dto.mileage !== undefined && { mileage: dto.mileage }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.VEHICLE_UPDATED,
      performedByUserId: userId,
      details: { vehicleId: id, changes: dto },
    });

    return this.mapToAdminDto(vehicle);
  }

  // ─── Vehicle State Machine Transition ───
  async updateVehicleState(
    id: string,
    dto: UpdateVehicleStateDto,
    userId?: string,
  ): Promise<AdminVehicleResponseDto> {
    const vehicle = await this.findAdminVehicleById(id);
    const currentState = vehicle.state;
    const nextState = dto.state;

    if (currentState === nextState) {
      return vehicle; // No-op
    }

    const validNextStates = this.allowedTransitions[currentState] || [];
    if (!validNextStates.includes(nextState)) {
      throw new BadRequestException(
        `Geçersiz araç durum geçişi: '${currentState}' durumundan '${nextState}' durumuna doğrudan geçilemez. İzin verilen geçişler: ${validNextStates.join(', ')}`,
      );
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: { state: nextState },
      include: {
        model: { include: { brand: true } },
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        branch: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.VEHICLE_UPDATED,
      performedByUserId: userId,
      details: {
        action: 'VEHICLE_STATE_CHANGED',
        vehicleId: id,
        fromState: currentState,
        toState: nextState,
        reason: dto.reason,
      },
    });

    return this.mapToAdminDto(updated);
  }

  // ─── Reference Data Management (BodyTypes, FuelTypes, Transmissions, Brands, Models) ───
  async getReferenceCatalog() {
    const [segments, bodyTypes, fuelTypes, transmissionTypes, brands] = await Promise.all([
      this.prisma.segment.findMany({ where: { isActive: true }, orderBy: { minAge: 'asc' } }),
      this.prisma.bodyType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.fuelType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.transmissionType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.brand.findMany({
        where: { isActive: true },
        include: { models: { where: { isActive: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { segments, bodyTypes, fuelTypes, transmissionTypes, brands };
  }

  async createBrand(dto: CreateNamedEntityDto): Promise<ReferenceDataResponseDto> {
    return this.prisma.brand.create({ data: { name: dto.name.trim() } });
  }

  async createModel(dto: CreateModelDto): Promise<ModelResponseDto> {
    return this.prisma.model.create({ data: { name: dto.name.trim(), brandId: dto.brandId } });
  }

  async createBodyType(dto: CreateNamedEntityDto): Promise<ReferenceDataResponseDto> {
    return this.prisma.bodyType.create({ data: { name: dto.name.trim() } });
  }

  async createFuelType(dto: CreateNamedEntityDto): Promise<ReferenceDataResponseDto> {
    return this.prisma.fuelType.create({ data: { name: dto.name.trim() } });
  }

  async createTransmissionType(dto: CreateNamedEntityDto): Promise<ReferenceDataResponseDto> {
    return this.prisma.transmissionType.create({ data: { name: dto.name.trim() } });
  }

  async deactivateBrand(id: string) {
    return this.prisma.brand.update({ where: { id }, data: { isActive: false } });
  }

  async deactivateModel(id: string) {
    return this.prisma.model.update({ where: { id }, data: { isActive: false } });
  }

  async deactivateBodyType(id: string) {
    return this.prisma.bodyType.update({ where: { id }, data: { isActive: false } });
  }

  async deactivateFuelType(id: string) {
    return this.prisma.fuelType.update({ where: { id }, data: { isActive: false } });
  }

  async deactivateTransmissionType(id: string) {
    return this.prisma.transmissionType.update({ where: { id }, data: { isActive: false } });
  }

  // ─── DTO Mappings ───
  public mapToPublicDto(v: any): PublicVehicleResponseDto {
    return {
      id: v.id,
      brandName: v.model.brand.name,
      modelName: v.model.name,
      segmentName: v.segment.name,
      bodyTypeName: v.bodyType.name,
      fuelTypeName: v.fuelType.name,
      transmissionTypeName: v.transmission.name,
      branchId: v.branchId,
      branchName: v.branch.name,
      state: v.state,
      year: v.year,
    };
  }

  public mapToAdminDto(v: any): AdminVehicleResponseDto {
    return {
      ...this.mapToPublicDto(v),
      vin: v.vin,
      licensePlate: v.licensePlate,
      mileage: v.mileage,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }
}
