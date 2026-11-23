import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceMatrixResponseDto, UpdateDailyPriceDto } from './dto/pricing.dto';

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(
    private pricingService: PricingService,
    private prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Güncel segment ve kasa tipi fiyat matrisini listeler (Herkese Açık)' })
  @ApiResponse({ status: 200, type: [PriceMatrixResponseDto] })
  @Get()
  async getPricingMatrix(): Promise<PriceMatrixResponseDto[]> {
    return this.pricingService.getPricingMatrix(true);
  }

  @ApiOperation({
    summary: 'Segment ve kasa tipi için günlük kiralama fiyatı tanımlar/günceller',
    description:
      'Yalnızca SUPER_ADMIN veya canManagePricing yetkili personel erişebilir. Not: Segment asgari yaş ve ehliyet kuralları sabit iş kuralı olduğu için değiştirilemez.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
  @ApiResponse({ status: 200, type: PriceMatrixResponseDto })
  @Put(':segmentId/:bodyTypeId')
  async updatePrice(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('segmentId') segmentId: string,
    @Param('bodyTypeId') bodyTypeId: string,
    @Body() dto: UpdateDailyPriceDto,
  ): Promise<PriceMatrixResponseDto> {
    if (user.role === UserRole.STAFF) {
      const perm = await this.prisma.staffPermission.findUnique({
        where: { userId: user.sub },
      });
      if (!perm || !perm.canManagePricing) {
        throw new ForbiddenException('Bu işlem için canManagePricing yetkisi gereklidir.');
      }
    }

    return this.pricingService.updateDailyPrice(segmentId, bodyTypeId, dto, user.sub);
  }
}
