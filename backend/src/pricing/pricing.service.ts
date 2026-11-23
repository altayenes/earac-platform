import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';
import { PriceMatrixResponseDto, UpdateDailyPriceDto } from './dto/pricing.dto';

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getPricingMatrix(onlyActive = true): Promise<PriceMatrixResponseDto[]> {
    const prices = await this.prisma.segmentBodyTypePrice.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      include: {
        segment: true,
        bodyType: true,
      },
      orderBy: [{ segmentId: 'asc' }, { bodyTypeId: 'asc' }],
    });

    return prices.map((p) => ({
      id: p.id,
      segmentId: p.segmentId,
      segmentName: p.segment.name,
      minAge: p.segment.minAge,
      minLicenseYears: p.segment.minLicenseYears,
      bodyTypeId: p.bodyTypeId,
      bodyTypeName: p.bodyType.name,
      dailyPrice: Number(p.dailyPrice),
      isActive: p.isActive,
    }));
  }

  async getDailyPrice(
    segmentId: string,
    bodyTypeId: string,
  ): Promise<number | null> {
    const priceRecord = await this.prisma.segmentBodyTypePrice.findUnique({
      where: {
        segmentId_bodyTypeId: { segmentId, bodyTypeId },
      },
    });

    return priceRecord && priceRecord.isActive ? Number(priceRecord.dailyPrice) : null;
  }

  async updateDailyPrice(
    segmentId: string,
    bodyTypeId: string,
    dto: UpdateDailyPriceDto,
    userId?: string,
  ): Promise<PriceMatrixResponseDto> {
    const segment = await this.prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) throw new NotFoundException('Segment bulunamadı');

    const bodyType = await this.prisma.bodyType.findUnique({ where: { id: bodyTypeId } });
    if (!bodyType) throw new NotFoundException('Kasa tipi bulunamadı');

    const record = await this.prisma.segmentBodyTypePrice.upsert({
      where: {
        segmentId_bodyTypeId: { segmentId, bodyTypeId },
      },
      update: {
        dailyPrice: dto.dailyPrice,
        isActive: true,
      },
      create: {
        segmentId,
        bodyTypeId,
        dailyPrice: dto.dailyPrice,
        isActive: true,
      },
      include: {
        segment: true,
        bodyType: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      performedByUserId: userId,
      details: {
        action: 'PRICING_UPDATED',
        segment: segment.name,
        bodyType: bodyType.name,
        newPrice: dto.dailyPrice,
      },
    });

    return {
      id: record.id,
      segmentId: record.segmentId,
      segmentName: record.segment.name,
      minAge: record.segment.minAge,
      minLicenseYears: record.segment.minLicenseYears,
      bodyTypeId: record.bodyTypeId,
      bodyTypeName: record.bodyType.name,
      dailyPrice: Number(record.dailyPrice),
      isActive: record.isActive,
    };
  }
}
