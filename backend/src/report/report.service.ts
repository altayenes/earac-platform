import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, PaymentType, ReservationState, VehicleState } from '@prisma/client';
import {
  DashboardSummaryResponseDto,
  DailyRevenueItemDto,
  RevenueReportFilterDto,
  RevenueReportResponseDto,
} from './dto/report.dto';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(): Promise<DashboardSummaryResponseDto> {
    // 1. Rezervasyon durumları ve sayıları
    const reservationCounts = await this.prisma.reservation.groupBy({
      by: ['state'],
      _count: { _all: true },
    });

    const reservationsByState: Record<string, number> = {};
    let totalReservations = 0;
    for (const item of reservationCounts) {
      const count = item._count._all;
      reservationsByState[item.state] = count;
      totalReservations += count;
    }

    // 2. Araç durumları ve sayıları
    const vehicleCounts = await this.prisma.vehicle.groupBy({
      by: ['state'],
      _count: { _all: true },
    });

    const vehiclesByState: Record<string, number> = {};
    let totalVehicles = 0;
    for (const item of vehicleCounts) {
      const count = item._count._all;
      vehiclesByState[item.state] = count;
      totalVehicles += count;
    }

    // 3. Tahsilat ve İadeler (yalnızca başarılı - SUCCESS ödemeler)
    const successfulPayments = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.SUCCESS },
      select: { type: true, amount: true },
    });

    let totalCharged = 0;
    let totalRefunded = 0;

    for (const p of successfulPayments) {
      const amt = Number(p.amount);
      if (p.type === PaymentType.CHARGE) {
        totalCharged += amt;
      } else if (p.type === PaymentType.REFUND) {
        totalRefunded += amt;
      }
    }

    const netRevenue = totalCharged - totalRefunded;

    return {
      totalReservations,
      reservationsByState,
      totalVehicles,
      vehiclesByState,
      totalCharged: Math.round(totalCharged * 100) / 100,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
    };
  }

  async getRevenueReport(filter: RevenueReportFilterDto): Promise<RevenueReportResponseDto> {
    const whereClause: any = {};

    if (filter.startDate || filter.endDate) {
      whereClause.startTime = {};
      if (filter.startDate) {
        whereClause.startTime.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        whereClause.startTime.lte = new Date(filter.endDate);
      }
    }

    // İlgili tarih aralığında başlangıcı olan rezervasyonlar ve ödemeleri
    const reservations = await this.prisma.reservation.findMany({
      where: whereClause,
      include: {
        payments: {
          where: { status: PaymentStatus.SUCCESS },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    let totalCharged = 0;
    let totalRefunded = 0;

    const dailyMap = new Map<string, { count: number; charged: number; refunded: number }>();

    for (const res of reservations) {
      const dateKey = res.startTime.toISOString().slice(0, 10);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { count: 0, charged: 0, refunded: 0 });
      }

      const entry = dailyMap.get(dateKey)!;
      entry.count += 1;

      for (const p of res.payments) {
        const amt = Number(p.amount);
        if (p.type === PaymentType.CHARGE) {
          totalCharged += amt;
          entry.charged += amt;
        } else if (p.type === PaymentType.REFUND) {
          totalRefunded += amt;
          entry.refunded += amt;
        }
      }
    }

    const dailyBreakdown: DailyRevenueItemDto[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      reservationCount: data.count,
      chargedAmount: Math.round(data.charged * 100) / 100,
      refundedAmount: Math.round(data.refunded * 100) / 100,
      netAmount: Math.round((data.charged - data.refunded) * 100) / 100,
    }));

    return {
      startDate: filter.startDate,
      endDate: filter.endDate,
      totalReservations: reservations.length,
      totalCharged: Math.round(totalCharged * 100) / 100,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      netRevenue: Math.round((totalCharged - totalRefunded) * 100) / 100,
      dailyBreakdown,
    };
  }
}
