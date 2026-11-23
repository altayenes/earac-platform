import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  ReservationState,
  VehicleState,
  UserRole,
} from '@prisma/client';
import {
  DeliverVehicleDto,
  ReturnVehicleDto,
  HandoverRecordResponseDto,
  ReturnRecordResponseDto,
} from './dto/handover.dto';
import { AdminVehicleResponseDto } from '../vehicles/dto/vehicle.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class HandoverService {
  private readonly logger = new Logger(HandoverService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ─── 1. Get Matching Available Vehicles for Handover at Branch ───
  async getMatchingAvailableVehicles(
    reservationId: string,
  ): Promise<AdminVehicleResponseDto[]> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { priceSnapshot: true },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (reservation.state !== ReservationState.CONFIRMED) {
      throw new BadRequestException(
        `Yalnızca CONFIRMED durumundaki rezervasyonlara araç teslim edilebilir (Mevcut durum: ${reservation.state})`,
      );
    }

    // Matching vehicles at reservation's branch
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        branchId: reservation.branchId,
        isActive: true,
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
      orderBy: { mileage: 'asc' },
    });

    return vehicles.map((v) => ({
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
      vin: v.vin,
      licensePlate: v.licensePlate,
      mileage: v.mileage,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }

  // ─── Paginated Eligible Vehicles for Handover at Branch ───
  async getEligibleVehiclesPaginated(
    reservationId: string,
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<AdminVehicleResponseDto>> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { priceSnapshot: true },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (reservation.state !== ReservationState.CONFIRMED) {
      throw new BadRequestException(
        `Yalnızca CONFIRMED durumundaki rezervasyonlara araç teslim edilebilir (Mevcut durum: ${reservation.state})`,
      );
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where = {
      branchId: reservation.branchId,
      isActive: true,
      state: VehicleState.AVAILABLE,
    };

    const [total, vehicles] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        include: {
          model: { include: { brand: true } },
          segment: true,
          bodyType: true,
          fuelType: true,
          transmission: true,
          branch: true,
        },
        orderBy: { mileage: 'asc' },
        take: limit,
        skip,
      }),
    ]);

    const data: AdminVehicleResponseDto[] = vehicles.map((v) => ({
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
      vin: v.vin,
      licensePlate: v.licensePlate,
      mileage: v.mileage,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ─── 2. Deliver Vehicle (Handover -> Reservation: ACTIVE, Vehicle: RENTED) ───
  async deliverVehicle(
    staffUser: { id: string; role: UserRole },
    dto: DeliverVehicleDto,
  ): Promise<HandoverRecordResponseDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: { priceSnapshot: true, customer: true },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (reservation.state !== ReservationState.CONFIRMED) {
      throw new BadRequestException(
        `Yalnızca CONFIRMED durumundaki rezervasyonlar teslim edilebilir (Mevcut durum: ${reservation.state})`,
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      include: {
        segment: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
      },
    });

    if (!vehicle || !vehicle.isActive) {
      throw new NotFoundException('Teslim edilecek araç bulunamadı');
    }

    if (vehicle.state !== VehicleState.AVAILABLE) {
      throw new BadRequestException(
        `Seçilen araç müsait (AVAILABLE) durumda değildir (Mevcut durum: ${vehicle.state})`,
      );
    }

    if (vehicle.branchId !== reservation.branchId) {
      throw new BadRequestException('Seçilen araç rezervasyon şubesinde bulunmamaktadır');
    }

    // Verify exact match with reservation price snapshot
    const snap = reservation.priceSnapshot;
    const isExactMatch =
      snap &&
      vehicle.segment.name === snap.segmentName &&
      vehicle.bodyType.name === snap.bodyTypeName;

    let isUpgrade = false;
    if (!isExactMatch) {
      // Exception upgrade check: Requires SUPER_ADMIN override + customer approval
      if (!dto.isExceptionUpgrade || !dto.customerApproved) {
        throw new BadRequestException(
          'Seçilen araç rezervasyon segment ve gövde tipiyle eşleşmiyor. İstisnai üst/eşdeğer araç ataması için isExceptionUpgrade: true ve customerApproved: true onayları zorunludur.',
        );
      }

      if (staffUser.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Stok tükenmesi durumunda eşdeğer/üst segment istisnai araç ataması yalnızca SUPER_ADMIN onayı ile yapılabilir.',
        );
      }

      isUpgrade = true;
    }

    // Execute atomic transaction
    const record = await this.prisma.$transaction(async (tx) => {
      // 1. Create HandoverRecord
      const handover = await tx.handoverRecord.create({
        data: {
          reservationId: reservation.id,
          vehicleId: vehicle.id,
          mileageOut: dto.mileageOut,
          fuelLevelOut: dto.fuelLevelOut,
          isExceptionUpgrade: isUpgrade,
          customerApproved: dto.customerApproved || false,
          actualPickupAt: dto.actualPickupAt ? new Date(dto.actualPickupAt) : new Date(),
          notes: dto.notes,
          performedBy: staffUser.id,
        },
      });

      // 2. Update Reservation: vehicleId & ACTIVE
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          vehicleId: vehicle.id,
          state: ReservationState.ACTIVE,
        },
      });

      // 3. Update Vehicle: state = RENTED, mileage = mileageOut
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          state: VehicleState.RENTED,
          mileage: dto.mileageOut,
        },
      });

      // 4. Record status history
      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          fromStatus: ReservationState.CONFIRMED,
          toStatus: ReservationState.ACTIVE,
          changedById: staffUser.id,
          reason: isUpgrade
            ? `VEHICLE_DELIVERED_WITH_EXCEPTION_UPGRADE (${vehicle.licensePlate})`
            : `VEHICLE_DELIVERED (${vehicle.licensePlate})`,
        },
      });

      return handover;
    });

    if (isUpgrade) {
      await this.auditService.log({
        action: AuditAction.VEHICLE_EXCEPTION_ASSIGNED,
        performedByUserId: staffUser.id,
        reservationId: reservation.id,
        details: {
          assignedVehicleId: vehicle.id,
          plate: vehicle.licensePlate,
          assignedSegment: vehicle.segment.name,
          requestedSegment: snap?.segmentName,
        },
      });
    }

    await this.auditService.log({
      action: AuditAction.HANDOVER_COMPLETED,
      performedByUserId: staffUser.id,
      reservationId: reservation.id,
      details: {
        vehicleId: vehicle.id,
        plate: vehicle.licensePlate,
        mileageOut: dto.mileageOut,
        fuelLevelOut: dto.fuelLevelOut,
      },
    });

    return record;
  }

  // ─── 3. Return Vehicle (Reservation: COMPLETED, Vehicle: AVAILABLE / DAMAGED_OUT_OF_SERVICE) ───
  async returnVehicle(
    staffUser: { id: string; role: UserRole },
    dto: ReturnVehicleDto,
  ): Promise<ReturnRecordResponseDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: { handoverRecord: true, vehicle: true },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (reservation.state !== ReservationState.ACTIVE) {
      throw new BadRequestException(
        `Yalnızca aktif (ACTIVE) durumundaki rezervasyonlar iade alınabilir (Mevcut durum: ${reservation.state})`,
      );
    }

    if (!reservation.handoverRecord) {
      throw new BadRequestException('Rezervasyona ait teslim alma (Handover) kaydı bulunamadı');
    }

    if (!reservation.vehicleId) {
      throw new BadRequestException('Rezervasyona atanmış araç bulunamadı');
    }

    // Mileage validation: mileageIn >= mileageOut
    if (dto.mileageIn < reservation.handoverRecord.mileageOut) {
      throw new BadRequestException(
        `İade kilometresi (${dto.mileageIn} km), teslimat kilometresinden (${reservation.handoverRecord.mileageOut} km) daha az olamaz!`,
      );
    }

    const nextVehicleState = dto.hasDamage
      ? VehicleState.DAMAGED_OUT_OF_SERVICE
      : VehicleState.AVAILABLE;

    const actualReturnAt = dto.actualReturnAt ? new Date(dto.actualReturnAt) : new Date();
    const endTime = reservation.endTime ? new Date(reservation.endTime) : actualReturnAt;
    const isLateReturn = actualReturnAt.getTime() > endTime.getTime();
    const lateMinutes = isLateReturn
      ? Math.floor((actualReturnAt.getTime() - endTime.getTime()) / (60 * 1000))
      : 0;

    const returnRecord = await this.prisma.$transaction(async (tx) => {
      // 1. Create ReturnRecord
      const record = await tx.returnRecord.create({
        data: {
          reservationId: reservation.id,
          vehicleId: reservation.vehicleId!,
          mileageIn: dto.mileageIn,
          fuelLevelIn: dto.fuelLevelIn,
          hasDamage: dto.hasDamage,
          damageNotes: dto.damageNotes,
          isLateReturn,
          lateMinutes,
          actualReturnAt,
          notes: dto.notes,
          performedBy: staffUser.id,
        },
      });

      // 2. Update Reservation: COMPLETED
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { state: ReservationState.COMPLETED },
      });

      // 3. Update Vehicle state and mileage
      await tx.vehicle.update({
        where: { id: reservation.vehicleId! },
        data: {
          state: nextVehicleState,
          mileage: dto.mileageIn,
        },
      });

      // 4. Status history
      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          fromStatus: ReservationState.ACTIVE,
          toStatus: ReservationState.COMPLETED,
          changedById: staffUser.id,
          reason: dto.hasDamage
            ? 'VEHICLE_RETURNED_WITH_DAMAGE'
            : 'VEHICLE_RETURNED_CLEAN',
        },
      });

      return record;
    });

    if (dto.hasDamage) {
      await this.auditService.log({
        action: AuditAction.VEHICLE_DAMAGED_ON_RETURN,
        performedByUserId: staffUser.id,
        reservationId: reservation.id,
        details: {
          vehicleId: reservation.vehicleId,
          damageNotes: dto.damageNotes,
          newState: VehicleState.DAMAGED_OUT_OF_SERVICE,
        },
      });
    }

    await this.auditService.log({
      action: AuditAction.RETURN_COMPLETED,
      performedByUserId: staffUser.id,
      reservationId: reservation.id,
      details: {
        mileageIn: dto.mileageIn,
        fuelLevelIn: dto.fuelLevelIn,
        hasDamage: dto.hasDamage,
        isLateReturn,
        lateMinutes,
      },
    });

    return returnRecord;
  }

  // ─── 4. Mark NO_SHOW ───
  async markNoShow(
    reservationId: string,
    staffUserId: string,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadı');
    }

    if (reservation.state !== ReservationState.CONFIRMED) {
      throw new BadRequestException(
        `Yalnızca CONFIRMED durumundaki rezervasyonlar NO_SHOW işaretlenebilir (Mevcut durum: ${reservation.state})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservationId },
        data: { state: ReservationState.NO_SHOW },
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId,
          fromStatus: ReservationState.CONFIRMED,
          toStatus: ReservationState.NO_SHOW,
          changedById: staffUserId,
          reason: 'CUSTOMER_FAILED_TO_ARRIVE_NO_SHOW',
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.RESERVATION_NO_SHOW,
      performedByUserId: staffUserId,
      reservationId,
      details: { action: 'RESERVATION_MARKED_NO_SHOW' },
    });

    return { success: true, message: 'Rezervasyon NO_SHOW olarak işaretlendi ve kapasite serbest bırakıldı.' };
  }
}
