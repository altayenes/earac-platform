import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  @ApiOperation({
    summary: 'Sistem ve Veritabanı Sağlık Kontrolü (Herkese Açık)',
    description: 'PostgreSQL bağlantısını test eder (SELECT 1), sunucu çalışma süresini ve zaman damgasını döner.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        uptimeSeconds: { type: 'number', example: 120 },
        database: { type: 'string', example: 'connected' },
        timestamp: { type: 'string', example: '2026-11-20T02:00:00.000Z' },
      },
    },
  })
  @Get()
  async checkHealth(@Res({ passthrough: true }) res: Response) {
    let dbStatus = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'disconnected';
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      uptimeSeconds,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
