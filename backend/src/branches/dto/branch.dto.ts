import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({
    description: 'Şube adı',
    example: 'İstanbul Havalimanı Şube',
  })
  @IsString()
  @IsNotEmpty({ message: 'Şube adı zorunludur' })
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Şube adresi',
    example: 'İstanbul Havalimanı İç/Dış Hatlar Terminali, Arnavutköy/İstanbul',
  })
  @IsString()
  @IsNotEmpty({ message: 'Şube adresi zorunludur' })
  @MaxLength(255)
  address: string;

  @ApiProperty({
    description: 'Açılış saati (HH:mm formatında)',
    example: '08:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Açılış saati HH:mm formatında olmalıdır (örn: 08:00)',
  })
  openingTime: string;

  @ApiProperty({
    description: 'Kapanış saati (HH:mm formatında)',
    example: '22:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Kapanış saati HH:mm formatında olmalıdır (örn: 22:00)',
  })
  closingTime: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({
    description: 'Şube adresi',
    example: 'İstanbul Havalimanı Yeni Terminal Girişi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    description: 'Açılış saati (HH:mm)',
    example: '07:30',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Açılış saati HH:mm formatında olmalıdır',
  })
  openingTime?: string;

  @ApiPropertyOptional({
    description: 'Kapanış saati (HH:mm)',
    example: '23:30',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Kapanış saati HH:mm formatında olmalıdır',
  })
  closingTime?: string;

  @ApiPropertyOptional({
    description: 'Şube aktiflik durumu',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BranchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: '08:00' })
  openingTime: string;

  @ApiProperty({ example: '22:00' })
  closingTime: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
