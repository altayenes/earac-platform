import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsIn,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ReservationState } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AvailabilitySearchDto {
  @ApiProperty({ description: 'Alış ve İade Şubesi ID', example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({
    description: 'Planlanan alış tarihi ve saati (ISO formatında)',
    example: '2026-12-01T10:00:00Z',
  })
  @IsDateString({}, { message: 'Geçerli bir alış tarihi giriniz' })
  plannedPickupAt: string;

  @ApiProperty({
    description: 'Planlanan iade tarihi ve saati (ISO formatında)',
    example: '2026-12-04T10:00:00Z',
  })
  @IsDateString({}, { message: 'Geçerli bir iade tarihi giriniz' })
  plannedReturnAt: string;

  @ApiPropertyOptional({ description: 'Filtre: Segment ID' })
  @IsOptional()
  @IsString()
  segmentId?: string;

  @ApiPropertyOptional({ description: 'Filtre: Kasa Tipi ID' })
  @IsOptional()
  @IsString()
  bodyTypeId?: string;

  @ApiPropertyOptional({ description: 'Filtre: Yakıt Tipi ID' })
  @IsOptional()
  @IsString()
  fuelTypeId?: string;

  @ApiPropertyOptional({ description: 'Filtre: Vites Tipi ID' })
  @IsOptional()
  @IsString()
  transmissionId?: string;
}

export class AvailableGroupResponseDto {
  @ApiProperty()
  segmentId: string;

  @ApiProperty()
  segmentName: string;

  @ApiProperty({ example: 21 })
  minAge: number;

  @ApiProperty({ example: 2 })
  minLicenseYears: number;

  @ApiProperty()
  bodyTypeId: string;

  @ApiProperty()
  bodyTypeName: string;

  @ApiProperty()
  fuelTypeId: string;

  @ApiProperty()
  fuelTypeName: string;

  @ApiProperty()
  transmissionTypeId: string;

  @ApiProperty()
  transmissionTypeName: string;

  @ApiProperty({ description: 'Günlük kiralama birim bedeli (TRY)', example: 850.0 })
  dailyPrice: number;

  @ApiProperty({ description: 'Kiralama gün sayısı (Minimum 1 gün)', example: 3 })
  totalDays: number;

  @ApiProperty({ description: 'Toplam rezervasyon tutarı (TRY)', example: 2550.0 })
  totalAmount: number;

  @ApiProperty({ description: 'Bu grupta seçilen tarih aralığında tam eşleşen müsait araç adedi', example: 2 })
  availableCount: number;
}

export class AvailabilityResponseDto {
  @ApiProperty({ type: [AvailableGroupResponseDto] })
  availableGroups: AvailableGroupResponseDto[];

  @ApiPropertyOptional({
    type: [AvailableGroupResponseDto],
    description: 'İstenen filtreli grupta müsait araç yoksa önerilen alternatif gruplar',
  })
  alternatives?: AvailableGroupResponseDto[];
}

export class CreateReservationDto {
  @ApiProperty({ description: 'Alış ve İade Şubesi ID' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Segment ID' })
  @IsString()
  @IsNotEmpty()
  segmentId: string;

  @ApiProperty({ description: 'Kasa Tipi ID' })
  @IsString()
  @IsNotEmpty()
  bodyTypeId: string;

  @ApiProperty({ description: 'Yakıt Tipi ID (Tam Eşleşme)' })
  @IsString()
  @IsNotEmpty()
  fuelTypeId: string;

  @ApiProperty({ description: 'Vites Tipi ID (Tam Eşleşme)' })
  @IsString()
  @IsNotEmpty()
  transmissionId: string;

  @ApiProperty({
    description: 'Planlanan alış tarihi ve saati (ISO formatında)',
    example: '2026-12-01T10:00:00Z',
  })
  @IsDateString()
  plannedPickupAt: string;

  @ApiProperty({
    description: 'Planlanan iade tarihi ve saati (ISO formatında)',
    example: '2026-12-04T10:00:00Z',
  })
  @IsDateString()
  plannedReturnAt: string;
}

export class CreateChangeRequestDto {
  @ApiPropertyOptional({ description: 'Yeni planlanan alış tarihi ve saati' })
  @IsOptional()
  @IsDateString()
  requestedPickupAt?: string;

  @ApiPropertyOptional({ description: 'Yeni planlanan iade tarihi ve saati' })
  @IsOptional()
  @IsDateString()
  requestedReturnAt?: string;

  @ApiPropertyOptional({ description: 'Yeni talep edilen Segment ID' })
  @IsOptional()
  @IsString()
  requestedSegmentId?: string;

  @ApiPropertyOptional({ description: 'Yeni talep edilen Kasa Tipi ID' })
  @IsOptional()
  @IsString()
  requestedBodyTypeId?: string;

  @ApiPropertyOptional({ description: 'Yeni talep edilen Yakıt Tipi ID' })
  @IsOptional()
  @IsString()
  requestedFuelTypeId?: string;

  @ApiPropertyOptional({ description: 'Yeni talep edilen Vites Tipi ID' })
  @IsOptional()
  @IsString()
  requestedTransmissionTypeId?: string;
}

export class ReviewChangeRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' })
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Yönetici inceleme notu', example: 'Müsaitlik doğrulandı ve onaylandı' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reviewNote?: string;
}

export class CancelReservationDto {
  @ApiPropertyOptional({
    description: 'İptal gerekçesi',
    example: 'Seyahat planım ertelendi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReservationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  branchName: string;

  @ApiPropertyOptional({ description: 'Atanan fiziksel araç ID (Teslimata kadar boştur)' })
  vehicleId: string | null;

  @ApiProperty()
  startTime: Date;

  @ApiProperty()
  endTime: Date;

  @ApiProperty({ enum: ReservationState })
  state: ReservationState;

  @ApiPropertyOptional({ description: 'Ödeme blokesi bitiş zamanı (15 dk)' })
  expiresAt: Date | null;

  @ApiPropertyOptional()
  priceSnapshot?: {
    segmentName: string;
    bodyTypeName: string;
    fuelTypeName?: string | null;
    transmissionTypeName?: string | null;
    dailyPrice: number;
    totalDays: number;
    totalAmount: number;
    currency: string;
  } | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AdminReservationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Şube ID filtresi' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ enum: ReservationState, description: 'Rezervasyon durumu filtresi' })
  @IsOptional()
  @IsEnum(ReservationState)
  state?: ReservationState;

  @ApiPropertyOptional({ description: 'Müşteri kullanıcı ID filtresi' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Başlangıç tarihi başlangıcı (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Başlangıç tarihi bitişi (ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminChangeRequestQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'], description: 'Talep durumu filtresi' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Rezervasyon ID filtresi' })
  @IsOptional()
  @IsString()
  reservationId?: string;
}
