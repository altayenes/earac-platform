import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({
    description: 'Personel telefon numarası (+905XXXXXXXXX)',
    example: '+905559876543',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+90|0)?5\d{9}$/, {
    message: 'Geçerli bir Türkiye cep telefonu numarası giriniz',
  })
  phone: string;

  @ApiProperty({
    description: 'Personel e-posta adresi',
    example: 'personel.ali@earackiralama.com',
  })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email: string;

  @ApiProperty({
    description: 'Personel parolası (En az 8 karakter)',
    example: 'PersonelParola123!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiPropertyOptional({ default: false, description: 'Araç ve filo yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageVehicles?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Rezervasyon yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageReservations?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Müşteri ve kullanıcı yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageUsers?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Şube yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageBranches?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Fiyat yönetimi yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManagePricing?: boolean;
}

export class UpdateStaffPermissionsDto {
  @ApiPropertyOptional({ description: 'Araç ve filo yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageVehicles?: boolean;

  @ApiPropertyOptional({ description: 'Rezervasyon yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageReservations?: boolean;

  @ApiPropertyOptional({ description: 'Müşteri ve kullanıcı yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageUsers?: boolean;

  @ApiPropertyOptional({ description: 'Şube yönetim yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManageBranches?: boolean;

  @ApiPropertyOptional({ description: 'Fiyat yönetimi yetkisi' })
  @IsOptional()
  @IsBoolean()
  canManagePricing?: boolean;
}

export class CloseAccountDto {
  @ApiPropertyOptional({
    description: 'Hesap kapatma gerekçesi',
    example: 'Artık araç kiralama hizmeti kullanmak istemiyorum',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
