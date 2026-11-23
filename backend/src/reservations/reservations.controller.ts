import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AvailabilitySearchDto,
  AvailableGroupResponseDto,
  CreateReservationDto,
  CreateChangeRequestDto,
  ReviewChangeRequestDto,
  ReservationResponseDto,
  CancelReservationDto,
  AdminReservationQueryDto,
  AdminChangeRequestQueryDto,
} from './dto/reservation.dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(
    private reservationsService: ReservationsService,
    private prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Misafir/Müşteri Müsaitlik Araması (Herkese Açık)',
    description:
      'Tarih aralığı (2 saatlik hazırlık tamponu dahil) ve şube bazında grup müsaitliğini hesaplar. Gizlilik kuralı gereği sonuçta araç plakası veya VIN ASLA dönmez; yalnızca grup adı, adet ve fiyat döner.',
  })
  @ApiResponse({ status: 200, type: [AvailableGroupResponseDto] })
  @Get('availability')
  async searchAvailability(
    @Query() dto: AvailabilitySearchDto,
  ): Promise<AvailableGroupResponseDto[]> {
    return this.reservationsService.searchAvailability(dto);
  }

  @ApiOperation({
    summary: 'Yeni Rezervasyon Oluşturur (15 Dakika Ödeme Blokesi)',
    description:
      'Müşteri profil uygunluk kurallarını (Economic 21/2, Medium 23/3, Premium 25/5) ve pg_advisory_xact_lock ile atomik kapasiteyi denetler. 15 dakikalık PENDING_PAYMENT blokesi açar.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiResponse({ status: 201, type: ReservationResponseDto })
  @Post()
  async createReservation(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    return this.reservationsService.createReservation(userId, dto);
  }

  @ApiOperation({ summary: 'Müşterinin kendi geçmiş ve aktif rezervasyonlarını listeler' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [ReservationResponseDto] })
  @Get('my')
  async getMyReservations(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: number,
  ): Promise<ReservationResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, limit ? Number(limit) : 50));
    return this.reservationsService.findUserReservations(userId, safeLimit);
  }

  @ApiOperation({ summary: 'Müşterinin kendi geçmiş ve aktif rezervasyonlarını listeler (me alias)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [ReservationResponseDto] })
  @Get('me')
  async getMeReservations(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: number,
  ): Promise<ReservationResponseDto[]> {
    const safeLimit = Math.min(100, Math.max(1, limit ? Number(limit) : 50));
    return this.reservationsService.findUserReservations(userId, safeLimit);
  }

  @ApiOperation({ summary: 'Rezervasyon detayını getirir' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  @Get(':id')
  async getReservationById(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
  ): Promise<ReservationResponseDto> {
    return this.reservationsService.findReservationById(id, {
      id: user.sub,
      role: user.role,
    });
  }

  @ApiOperation({
    summary: 'Rezervasyon Değişiklik Talebi Oluşturur (Müşteri)',
    description:
      'Yalnızca CONFIRMED rezervasyonlar için değişiklik talep edilebilir. Yönetici onaylayana kadar eski rezervasyon geçerliliğini korur.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post(':id/change-request')
  async createChangeRequest(
    @CurrentUser('sub') userId: string,
    @Param('id') reservationId: string,
    @Body() dto: CreateChangeRequestDto,
  ) {
    return this.reservationsService.createChangeRequest(reservationId, userId, dto);
  }

  @ApiOperation({
    summary: 'Müşteri Rezervasyon İptali ve Otomatik Tam İade',
    description:
      'Yalnızca CONFIRMED veya PENDING_PAYMENT durumundaki rezervasyonlar iptal edilebilir. Ödenmiş bedel varsa otomatik tam tutarlı REFUND kaydı üretilir ve kapasite serbest bırakılır. Aktif kiralamalar iptal edilemez.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelReservation(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') reservationId: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancelReservation(
      reservationId,
      user.sub,
      user.role,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Rezervasyon Değişiklik Talebini İnceler (SUPER_ADMIN veya canManageReservations yetkili STAFF)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
  @Patch('change-requests/:id/review')
  async reviewChangeRequest(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') requestId: string,
    @Body() dto: ReviewChangeRequestDto,
  ) {
    if (user.role === UserRole.STAFF) {
      const perm = await this.prisma.staffPermission.findUnique({
        where: { userId: user.sub },
      });
      if (!perm || !perm.canManageReservations) {
        throw new ForbiddenException('Bu işlem için canManageReservations yetkisi gereklidir.');
      }
    }

    return this.reservationsService.reviewChangeRequest(requestId, user.sub, dto);
  }

  @ApiOperation({
    summary: 'Manuel Süresi Dolan Rezervasyon Temizliği (Test/Yönetici amaçlı)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('cron/trigger-expiration')
  @HttpCode(HttpStatus.OK)
  async triggerExpiration(): Promise<MessageResponseDto> {
    const count = await this.reservationsService.expirePendingReservations();
    return {
      success: true,
      message: `${count} adet süresi dolan PENDING_PAYMENT rezervasyonu EXPIRED durumuna getirildi.`,
    };
  }
}

@ApiTags('Admin / Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
@Controller('admin/reservations')
export class AdminReservationsController {
  constructor(
    private reservationsService: ReservationsService,
    private prisma: PrismaService,
  ) {}

  private async assertStaffPermission(user: { sub: string; role: UserRole }) {
    if (user.role === UserRole.STAFF) {
      const perm = await this.prisma.staffPermission.findUnique({
        where: { userId: user.sub },
      });
      if (!perm || !perm.canManageReservations) {
        throw new ForbiddenException('Bu işlem için canManageReservations yetkisi gereklidir.');
      }
    }
  }

  @ApiOperation({
    summary: 'Tüm rezervasyonları filtreli ve sayfalamalı olarak listeler (Yönetici & Personel)',
    description: 'Şube, durum, müşteri ve tarih aralığı filtreleri ile sayfalamalı standart zarfta sunar.',
  })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  @Get()
  async getReservations(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query() query: AdminReservationQueryDto,
  ): Promise<PaginatedResponseDto<ReservationResponseDto>> {
    await this.assertStaffPermission(user);
    return this.reservationsService.getAdminReservationsPaginated(query);
  }

  @ApiOperation({
    summary: 'Rezervasyon değişiklik taleplerini listeler (Yönetici & Personel)',
    description: 'PENDING, APPROVED, REJECTED durum filtreleri ile sayfalamalı standart zarfta sunar.',
  })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  @Get('change-requests')
  async getChangeRequests(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query() query: AdminChangeRequestQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    await this.assertStaffPermission(user);
    return this.reservationsService.getAdminChangeRequestsPaginated(query);
  }
}
