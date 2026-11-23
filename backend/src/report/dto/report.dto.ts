import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class RevenueReportFilterDto {
  @ApiPropertyOptional({ description: 'Başlangıç tarihi (ISO formatı)', example: '2026-11-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Bitiş tarihi (ISO formatı)', example: '2026-11-30T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ description: 'Toplam rezervasyon sayısı', example: 42 })
  totalReservations: number;

  @ApiProperty({
    description: 'Durumlarına göre rezervasyon sayıları',
    example: { CONFIRMED: 12, ACTIVE: 5, COMPLETED: 20, CANCELLED: 3, NO_SHOW: 2 },
  })
  reservationsByState: Record<string, number>;

  @ApiProperty({ description: 'Toplam araç sayısı', example: 8 })
  totalVehicles: number;

  @ApiProperty({
    description: 'Durumlarına göre araç sayıları',
    example: { AVAILABLE: 5, RENTED: 2, MAINTENANCE: 1, DAMAGED_OUT_OF_SERVICE: 0, INACTIVE: 0 },
  })
  vehiclesByState: Record<string, number>;

  @ApiProperty({ description: 'Toplam tahsil edilen kiralama bedeli (TRY)', example: 35000.0 })
  totalCharged: number;

  @ApiProperty({ description: 'İptal edilen rezervasyonlara iade edilen toplam tutar (TRY)', example: 2500.0 })
  totalRefunded: number;

  @ApiProperty({ description: 'Net gelir (Tahsilat - İadeler) (TRY)', example: 32500.0 })
  netRevenue: number;
}

export class DailyRevenueItemDto {
  @ApiProperty({ description: 'Tarih (YYYY-MM-DD)', example: '2026-11-15' })
  date: string;

  @ApiProperty({ description: 'Kiralama başlangıcı bu gün olan rezervasyon sayısı', example: 4 })
  reservationCount: number;

  @ApiProperty({ description: 'Bu gün başlangıçlı rezervasyonlardan tahsil edilen toplam tutar', example: 6400.0 })
  chargedAmount: number;

  @ApiProperty({ description: 'Bu güne ait iade tutarı', example: 0.0 })
  refundedAmount: number;

  @ApiProperty({ description: 'Net gelir', example: 6400.0 })
  netAmount: number;
}

export class RevenueReportResponseDto {
  @ApiPropertyOptional({ description: 'Filtre başlangıç tarihi', example: '2026-11-01T00:00:00Z' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filtre bitiş tarihi', example: '2026-11-30T23:59:59Z' })
  endDate?: string;

  @ApiProperty({ description: 'Filtre aralığındaki toplam rezervasyon sayısı', example: 25 })
  totalReservations: number;

  @ApiProperty({ description: 'Toplam tahsilat (TRY)', example: 35000.0 })
  totalCharged: number;

  @ApiProperty({ description: 'Toplam iade (TRY)', example: 2500.0 })
  totalRefunded: number;

  @ApiProperty({ description: 'Net gelir (TRY)', example: 32500.0 })
  netRevenue: number;

  @ApiProperty({ description: 'Günlük döküm', type: [DailyRevenueItemDto] })
  dailyBreakdown: DailyRevenueItemDto[];
}
