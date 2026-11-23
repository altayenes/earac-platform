import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { HandoverService } from './handover.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeliverVehicleDto,
  ReturnVehicleDto,
  HandoverRecordResponseDto,
  ReturnRecordResponseDto,
} from './dto/handover.dto';
import { AdminVehicleResponseDto } from '../vehicles/dto/vehicle.dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@ApiTags('Handover & Return (Staff Operations)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
@Controller('handover')
export class HandoverController {
  constructor(
    private handoverService: HandoverService,
    private prisma: PrismaService,
  ) {}

  private async assertStaffPermission(
    user: { sub: string; role: UserRole },
    permission: 'canManageReservations' | 'canManageVehicles',
  ): Promise<void> {
    if (user.role === UserRole.STAFF) {
      const perm = await this.prisma.staffPermission.findUnique({
        where: { userId: user.sub },
      });
      if (!perm || !perm[permission]) {
        throw new ForbiddenException(
          `Bu operasyonel işlem için ${permission} yetkisi gereklidir.`,
        );
      }
    }
  }

  @ApiOperation({
    summary: 'Rezervasyona teslim edilebilecek şubedeki müsait araçları listeler',
    description: 'Şubede AVAILABLE durumunda olan uygun araçları plaka ve kilometreleriyle birlikte döner.',
  })
  @ApiResponse({ status: 200, type: [AdminVehicleResponseDto] })
  @Get('available-vehicles/:reservationId')
  async getAvailableVehicles(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('reservationId') reservationId: string,
  ): Promise<AdminVehicleResponseDto[]> {
    await this.assertStaffPermission(user, 'canManageReservations');
    return this.handoverService.getMatchingAvailableVehicles(reservationId);
  }

  @ApiOperation({
    summary: 'Rezervasyona teslim edilebilecek uygun araçları sayfalamalı standart zarfta listeler',
    description: 'Handover öncesi tam eşleşen veya uygun araçları sayfalamalı meta zarfı ile döner.',
  })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  @Get('eligible-vehicles/:reservationId')
  async getEligibleVehicles(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('reservationId') reservationId: string,
    @Query() query: PaginationDto,
  ): Promise<PaginatedResponseDto<AdminVehicleResponseDto>> {
    await this.assertStaffPermission(user, 'canManageReservations');
    return this.handoverService.getEligibleVehiclesPaginated(reservationId, query);
  }

  @ApiOperation({
    summary: 'Araç Teslimatı Yapar (Reservation: ACTIVE, Vehicle: RENTED)',
    description:
      'Kilometre ve yakıt kaydı alır. Araç grubu eşleşmiyorsa yalnızca SUPER_ADMIN onayı ve customerApproved: true bayrağı ile fiyat farksız istisnai üst segment yükseltmesi yapılabilir.',
  })
  @ApiResponse({ status: 201, type: HandoverRecordResponseDto })
  @Post('deliver')
  async deliverVehicle(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: DeliverVehicleDto,
  ): Promise<HandoverRecordResponseDto> {
    await this.assertStaffPermission(user, 'canManageReservations');
    return this.handoverService.deliverVehicle(
      { id: user.sub, role: user.role },
      dto,
    );
  }

  @ApiOperation({
    summary: 'Araç İadesi Alır (Reservation: COMPLETED, Vehicle: AVAILABLE veya DAMAGED_OUT_OF_SERVICE)',
    description:
      'İade kilometresi >= teslimat kilometresi kontrolü yapılır. hasDamage: true ise araç otomatik olarak DAMAGED_OUT_OF_SERVICE durumuna alınır.',
  })
  @ApiResponse({ status: 200, type: ReturnRecordResponseDto })
  @Post('return')
  @HttpCode(HttpStatus.OK)
  async returnVehicle(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: ReturnVehicleDto,
  ): Promise<ReturnRecordResponseDto> {
    await this.assertStaffPermission(user, 'canManageReservations');
    return this.handoverService.returnVehicle(
      { id: user.sub, role: user.role },
      dto,
    );
  }

  @ApiOperation({
    summary: 'Teslim Alınmayan Rezervasyonu NO_SHOW İşaretler (CONFIRMED -> NO_SHOW)',
  })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @Post('no-show/:reservationId')
  @HttpCode(HttpStatus.OK)
  async markNoShow(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('reservationId') reservationId: string,
  ): Promise<MessageResponseDto> {
    await this.assertStaffPermission(user, 'canManageReservations');
    return this.handoverService.markNoShow(reservationId, user.sub);
  }
}
