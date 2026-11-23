import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class DeliverVehicleDto {
  @ApiProperty({ description: 'Teslim edilecek rezervasyon ID' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({ description: 'Müşteriye fiziken teslim edilen araç ID' })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({ description: 'Teslim anındaki araç kilometresi', example: 15200 })
  @IsInt()
  @Min(0)
  mileageOut: number;

  @ApiProperty({ description: 'Teslim anındaki yakıt seviyesi (Yüzde 0-100)', example: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  fuelLevelOut: number;

  @ApiPropertyOptional({ description: 'Fiili teslim zamanı (ISO)' })
  @IsOptional()
  @IsDateString()
  actualPickupAt?: string;

  @ApiPropertyOptional({
    description: 'İstisnai Eşdeğer/Üst Segment Yükseltme Bayrağı (Stok tükenmesi durumunda)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isExceptionUpgrade?: boolean;

  @ApiPropertyOptional({
    description: 'Yükseltme için müşteri onayı alındı mı?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  customerApproved?: boolean;

  @ApiPropertyOptional({ description: 'Teslimat notları' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class ReturnVehicleDto {
  @ApiProperty({ description: 'İade alınan rezervasyon ID' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({ description: 'İade anındaki araç kilometresi (mileageIn >= mileageOut olmalıdır)', example: 15850 })
  @IsInt()
  @Min(0)
  mileageIn: number;

  @ApiProperty({ description: 'İade anındaki yakıt seviyesi (Yüzde 0-100)', example: 90 })
  @IsInt()
  @Min(0)
  @Max(100)
  fuelLevelIn: number;

  @ApiProperty({ description: 'Araçta hasar tespit edildi mi?', example: false })
  @IsBoolean()
  hasDamage: boolean;

  @ApiPropertyOptional({ description: 'Hasar tespit edildiyse açıklama notu', example: 'Ön tampon sağ köşede çizik' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  damageNotes?: string;

  @ApiPropertyOptional({ description: 'Fiili iade zamanı (ISO)' })
  @IsOptional()
  @IsDateString()
  actualReturnAt?: string;

  @ApiPropertyOptional({ description: 'Genel iade notları' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class HandoverRecordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reservationId: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  mileageOut: number;

  @ApiProperty()
  fuelLevelOut: number;

  @ApiProperty()
  isExceptionUpgrade: boolean;

  @ApiProperty()
  customerApproved: boolean;

  @ApiProperty()
  actualPickupAt: Date;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  performedBy?: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class ReturnRecordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reservationId: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  mileageIn: number;

  @ApiProperty()
  fuelLevelIn: number;

  @ApiProperty()
  hasDamage: boolean;

  @ApiPropertyOptional()
  damageNotes?: string | null;

  @ApiProperty({ description: 'İade planlanan süreyi aştı mı?', example: false })
  isLateReturn: boolean;

  @ApiProperty({ description: 'Gecikme süresi (dakika)', example: 0 })
  lateMinutes: number;

  @ApiProperty()
  actualReturnAt: Date;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  performedBy?: string | null;

  @ApiProperty()
  createdAt: Date;
}
