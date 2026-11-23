import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { VehicleState } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ description: '17 haneli araç şasi numarası (VIN)', example: 'TEST00000000000099' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/, {
    message: 'VIN numarası geçerli 17 haneli formatta olmalıdır',
  })
  vin: string;

  @ApiProperty({ description: 'Araç plakası', example: '34 AK 999' })
  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @ApiProperty({ description: 'Model ID' })
  @IsString()
  @IsNotEmpty()
  modelId: string;

  @ApiProperty({ description: 'Segment ID' })
  @IsString()
  @IsNotEmpty()
  segmentId: string;

  @ApiProperty({ description: 'Kasa Tipi ID' })
  @IsString()
  @IsNotEmpty()
  bodyTypeId: string;

  @ApiProperty({ description: 'Yakıt Tipi ID' })
  @IsString()
  @IsNotEmpty()
  fuelTypeId: string;

  @ApiProperty({ description: 'Vites Tipi ID' })
  @IsString()
  @IsNotEmpty()
  transmissionId: string;

  @ApiProperty({ description: 'Bulunduğu Şube ID' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Model yılı', example: 2024 })
  @IsInt()
  @Min(2010)
  @Max(2030)
  year: number;

  @ApiPropertyOptional({ description: 'Güncel kilometre', default: 0, example: 12000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ description: 'Yeni kilometre', example: 15500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @ApiPropertyOptional({ description: 'Yeni şube ID' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Aktiflik durumu' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVehicleStateDto {
  @ApiProperty({
    description: 'Yeni araç durumu (State Machine kurallarına tabi)',
    enum: VehicleState,
    example: VehicleState.MAINTENANCE,
  })
  @IsEnum(VehicleState)
  state: VehicleState;

  @ApiPropertyOptional({
    description: 'Durum değişikliği gerekçesi (Örn: Periyodik bakım, parça değişimi)',
    example: '15.000 km periyodik bakımı',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/// Müşteri / Misafir İçin Halka Açık DTO (VIN ve Plaka ASLA DÖNMEZ!)
export class PublicVehicleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  brandName: string;

  @ApiProperty()
  modelName: string;

  @ApiProperty()
  segmentName: string;

  @ApiProperty()
  bodyTypeName: string;

  @ApiProperty()
  fuelTypeName: string;

  @ApiProperty()
  transmissionTypeName: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  branchName: string;

  @ApiProperty({ enum: VehicleState })
  state: VehicleState;

  @ApiProperty()
  year: number;
}

/// Yönetim / Personel İçin Detaylı DTO (VIN, Plaka, KM dahil)
export class AdminVehicleResponseDto extends PublicVehicleResponseDto {
  @ApiProperty({ description: 'Şasi numarası (Sadece yetkili personel görür)' })
  vin: string;

  @ApiProperty({ description: 'Plaka (Sadece yetkili personel görür)' })
  licensePlate: string;

  @ApiProperty()
  mileage: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
