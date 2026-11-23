import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateDailyPriceDto {
  @ApiProperty({ description: 'Yeni günlük kiralama bedeli (TRY)', example: 1250.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100, { message: 'Günlük fiyat en az 100 TRY olmalıdır' })
  dailyPrice: number;
}

export class PriceMatrixResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  segmentId: string;

  @ApiProperty()
  segmentName: string;

  @ApiProperty({ description: 'Referans: Asgari yaş kuralı (Değiştirilemez)', example: 21 })
  minAge: number;

  @ApiProperty({ description: 'Referans: Asgari ehliyet yılı (Değiştirilemez)', example: 2 })
  minLicenseYears: number;

  @ApiProperty()
  bodyTypeId: string;

  @ApiProperty()
  bodyTypeName: string;

  @ApiProperty({ example: 1200.0 })
  dailyPrice: number;

  @ApiProperty()
  isActive: boolean;
}
