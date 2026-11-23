import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuditLogQueryDto } from './dto/audit-query.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@ApiTags('Admin / Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private auditService: AuditService) {}

  @ApiOperation({
    summary: 'Sistem denetim ve işlem loglarını listeler (Yalnızca SUPER_ADMIN)',
    description:
      'Eylem türü, kullanıcı ve rezervasyon filtreleri ile sayfalamalı standart zarfta sunar.',
  })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  @Get()
  async getAuditLogs(
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.auditService.getPaginatedLogs(query);
  }
}
