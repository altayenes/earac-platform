import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

export interface CreateAuditLogParams {
  action: AuditAction;
  performedByUserId?: string;
  reservationId?: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  public sanitizeDetails(details: any): any {
    if (!details || typeof details !== 'object') {
      return details;
    }
    if (Array.isArray(details)) {
      return details.map((item) => this.sanitizeDetails(item));
    }

    const sensitiveKeywords = [
      'password',
      'passwordhash',
      'token',
      'refreshtoken',
      'accesstoken',
      'secret',
      'nationalid',
      'tckimlik',
      'nationalidencrypted',
      'cvv',
      'cardnumber',
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeywords.some((k) => lowerKey.includes(k));

      if (isSensitive && value !== null && value !== undefined) {
        sanitized[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async log(params: CreateAuditLogParams) {
    try {
      const record = await this.prisma.auditLog.create({
        data: {
          action: params.action,
          performedByUserId: params.performedByUserId,
          reservationId: params.reservationId,
          details: this.sanitizeDetails(params.details ?? {}),
        },
      });
      return record;
    } catch (error) {
      this.logger.error(`Failed to record audit log for action: ${params.action}`, error);
      // Non-blocking: audit failure should not crash main request, but should be alerted
      return null;
    }
  }

  async getLogs(filter?: {
    action?: AuditAction;
    performedByUserId?: string;
    reservationId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    return this.prisma.auditLog.findMany({
      where: {
        action: filter?.action,
        performedByUserId: filter?.performedByUserId,
        reservationId: filter?.reservationId,
      },
      include: {
        user: {
          select: { id: true, email: true, phone: true, role: true },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getPaginatedLogs(query: {
    action?: AuditAction;
    performedByUserId?: string;
    reservationId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponseDto<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where = {
      action: query.action,
      performedByUserId: query.performedByUserId,
      reservationId: query.reservationId,
    };

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, phone: true, role: true },
          },
        },
        orderBy: { performedAt: 'desc' },
        take: limit,
        skip,
      }),
    ]);

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
}
