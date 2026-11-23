import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportService } from './report.service';
import {
  DashboardSummaryResponseDto,
  RevenueReportFilterDto,
  RevenueReportResponseDto,
} from './dto/report.dto';

@ApiTags('Admin / Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.STAFF)
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Yönetici özet dashboard verilerini getirir',
    description:
      'Toplam rezervasyon sayıları (durum bazlı), filo durumu (müsait, kirada, bakımda, hasarlı) ve toplam tahsilat/iade/net gelir özetini sunar.',
  })
  @ApiResponse({ status: 200, type: DashboardSummaryResponseDto })
  @Get('dashboard')
  async getDashboardSummary(
    @CurrentUser() user: { sub: string; role: UserRole },
  ): Promise<DashboardSummaryResponseDto> {
    await this.assertReportPermission(user);
    return this.reportService.getDashboardSummary();
  }

  @ApiOperation({
    summary: 'Tarih aralıklı gelir ve finansal raporu getirir',
    description:
      'Kiralama başlangıç tarihi bazında toplam tahsilat, iadeler, net gelir ve günlük döküm listesini döndürür.',
  })
  @ApiResponse({ status: 200, type: RevenueReportResponseDto })
  @Get('revenue')
  async getRevenueReport(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query() filter: RevenueReportFilterDto,
  ): Promise<RevenueReportResponseDto> {
    await this.assertReportPermission(user);
    return this.reportService.getRevenueReport(filter);
  }

  private async assertReportPermission(user: { sub: string; role: UserRole }) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const perm = await this.prisma.staffPermission.findUnique({
      where: { userId: user.sub },
    });
    // Personel için rezervasyon veya fiyatlandırma yönetimi yetkilerinden en az birine sahip olması gerekir
    if (!perm || (!perm.canManageReservations && !perm.canManagePricing)) {
      throw new ForbiddenException(
        'Raporları görüntülemek için rezervasyon veya fiyatlandırma yetkisi gereklidir.',
      );
    }
  }
}
