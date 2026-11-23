import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, VehicleState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

@ApiTags('Vehicles (Public)')
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @ApiOperation({
    summary: 'Müsait araçları listeler (Herkese Açık)',
    description:
      'Önemli Gizlilik Kuralı: Bu uç noktada şasi numarası (VIN) ve araç plakası ASLA dönülmez!',
  })
  @ApiResponse({ status: 200, type: [PublicVehicleResponseDto] })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'segmentId', required: false })
  @ApiQuery({ name: 'bodyTypeId', required: false })
  @ApiQuery({ name: 'fuelTypeId', required: false })
  @ApiQuery({ name: 'transmissionId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Get()
  async getPublicVehicles(
    @Query('branchId') branchId?: string,
    @Query('segmentId') segmentId?: string,
    @Query('bodyTypeId') bodyTypeId?: string,
    @Query('fuelTypeId') fuelTypeId?: string,
    @Query('transmissionId') transmissionId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<PublicVehicleResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, limit ? Number(limit) : 50));
    const safeOffset = Math.max(0, offset ? Number(offset) : 0);
    return this.vehiclesService.findPublicVehicles({
      branchId,
      segmentId,
      bodyTypeId,
      fuelTypeId,
      transmissionId,
      limit: safeLimit,
      offset: safeOffset,
    });
  }

  @ApiOperation({ summary: 'Araç referans kataloğunu getirir (Segmentler, Kasalar, Yakıtlar, Vitesler, Markalar)' })
  @Get('catalog')
  async getReferenceCatalog() {
    return this.vehiclesService.getReferenceCatalog();
  }

  @ApiOperation({ summary: 'Araç detayını getirir (Plaka ve VIN gizlidir)' })
  @ApiResponse({ status: 200, type: PublicVehicleResponseDto })
  @Get(':id')
  async getPublicVehicleById(@Param('id') id: string): Promise<PublicVehicleResponseDto> {
    return this.vehiclesService.findPublicVehicleById(id);
  }
}

@ApiTags('Admin / Vehicle Fleet Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
@Controller('admin/vehicles')
export class AdminVehiclesController {
  constructor(
    private vehiclesService: VehiclesService,
    private prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Filodaki tüm araçları detaylı listeler (Plaka, VIN ve KM dahil)',
  })
  @ApiResponse({ status: 200, type: [AdminVehicleResponseDto] })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'state', enum: VehicleState, required: false })
  @ApiQuery({ name: 'onlyActive', type: Boolean, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  @Get()
  async getAdminVehicles(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('branchId') branchId?: string,
    @Query('state') state?: VehicleState,
    @Query('onlyActive') onlyActive?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<AdminVehicleResponseDto[]> {
    await this.assertStaffPermission(user, 'canManageVehicles');
    const safeLimit = Math.min(100, Math.max(1, limit ? Number(limit) : 50));
    const safeOffset = Math.max(0, offset ? Number(offset) : 0);
    return this.vehiclesService.findAdminVehicles({
      branchId,
      state,
      onlyActive: onlyActive !== 'false',
      limit: safeLimit,
      offset: safeOffset,
    });
  }

  @ApiOperation({ summary: 'Araç detayını getirir (VIN, Plaka dahil)' })
  @ApiResponse({ status: 200, type: AdminVehicleResponseDto })
  @Get(':id')
  async getAdminVehicleById(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
  ): Promise<AdminVehicleResponseDto> {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.findAdminVehicleById(id);
  }

  @ApiOperation({ summary: 'Filoya yeni araç ekler' })
  @ApiResponse({ status: 201, type: AdminVehicleResponseDto })
  @Post()
  async createVehicle(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: CreateVehicleDto,
  ): Promise<AdminVehicleResponseDto> {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.createVehicle(dto, user.sub);
  }

  @ApiOperation({ summary: 'Araç bilgilerini (KM, Şube, Aktiflik) günceller' })
  @ApiResponse({ status: 200, type: AdminVehicleResponseDto })
  @Patch(':id')
  async updateVehicle(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<AdminVehicleResponseDto> {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.updateVehicle(id, dto, user.sub);
  }

  @ApiOperation({
    summary: 'Araç durumunu günceller (5 Durumlu State Machine Geçiş Kontrolü)',
    description:
      'İzinli durum geçişleri: AVAILABLE <-> MAINTENANCE, AVAILABLE -> RENTED -> AVAILABLE/DAMAGED_OUT_OF_SERVICE, MAINTENANCE -> INACTIVE vb.',
  })
  @ApiResponse({ status: 200, type: AdminVehicleResponseDto })
  @Patch(':id/state')
  async updateVehicleState(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Body() dto: UpdateVehicleStateDto,
  ): Promise<AdminVehicleResponseDto> {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.updateVehicleState(id, dto, user.sub);
  }

  // ─── Reference Data Management Endpoints ───
  @ApiOperation({ summary: 'Yeni marka ekler' })
  @Post('references/brands')
  async createBrand(@CurrentUser() user: { sub: string; role: UserRole }, @Body() dto: CreateNamedEntityDto) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.createBrand(dto);
  }

  @ApiOperation({ summary: 'Yeni model ekler' })
  @Post('references/models')
  async createModel(@CurrentUser() user: { sub: string; role: UserRole }, @Body() dto: CreateModelDto) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.createModel(dto);
  }

  @ApiOperation({ summary: 'Yeni kasa tipi ekler' })
  @Post('references/body-types')
  async createBodyType(@CurrentUser() user: { sub: string; role: UserRole }, @Body() dto: CreateNamedEntityDto) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.createBodyType(dto);
  }

  @ApiOperation({ summary: 'Yeni yakıt tipi ekler' })
  @Post('references/fuel-types')
  async createFuelType(@CurrentUser() user: { sub: string; role: UserRole }, @Body() dto: CreateNamedEntityDto) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.createFuelType(dto);
  }

  @ApiOperation({ summary: 'Yeni vites tipi ekler' })
  @Post('references/transmissions')
  async createTransmission(@CurrentUser() user: { sub: string; role: UserRole }, @Body() dto: CreateNamedEntityDto) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.createTransmissionType(dto);
  }

  @ApiOperation({ summary: 'Markayı pasife alır (Fiziksel silme yasaktır)' })
  @Patch('references/brands/:id/deactivate')
  async deactivateBrand(@CurrentUser() user: { sub: string; role: UserRole }, @Param('id') id: string) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.deactivateBrand(id);
  }

  @ApiOperation({ summary: 'Modeli pasife alır (Fiziksel silme yasaktır)' })
  @Patch('references/models/:id/deactivate')
  async deactivateModel(@CurrentUser() user: { sub: string; role: UserRole }, @Param('id') id: string) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.deactivateModel(id);
  }

  @ApiOperation({ summary: 'Kasa tipini pasife alır (Fiziksel silme yasaktır)' })
  @Patch('references/body-types/:id/deactivate')
  async deactivateBodyType(@CurrentUser() user: { sub: string; role: UserRole }, @Param('id') id: string) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.deactivateBodyType(id);
  }

  @ApiOperation({ summary: 'Yakıt tipini pasife alır (Fiziksel silme yasaktır)' })
  @Patch('references/fuel-types/:id/deactivate')
  async deactivateFuelType(@CurrentUser() user: { sub: string; role: UserRole }, @Param('id') id: string) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.deactivateFuelType(id);
  }

  @ApiOperation({ summary: 'Vites tipini pasife alır (Fiziksel silme yasaktır)' })
  @Patch('references/transmissions/:id/deactivate')
  async deactivateTransmission(@CurrentUser() user: { sub: string; role: UserRole }, @Param('id') id: string) {
    await this.assertStaffPermission(user, 'canManageVehicles');
    return this.vehiclesService.deactivateTransmissionType(id);
  }

  private async assertStaffPermission(
    user: { sub: string; role: UserRole },
    field: 'canManageVehicles',
  ) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const perm = await this.prisma.staffPermission.findUnique({
      where: { userId: user.sub },
    });
    if (!perm || !perm[field]) {
      throw new ForbiddenException(`Bu işlem için ${field} yetkisi gereklidir.`);
    }
  }
}
