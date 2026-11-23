import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  IsOptional,
  IsEmail,
} from 'class-validator';

@ValidatorConstraint({ name: 'isTcKimlikNo', async: false })
export class IsTcKimlikNoConstraint implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    if (!/^[1-9]\d{10}$/.test(value)) return false;

    const digits = value.split('').map(Number);
    const d1_to_9_odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const d1_to_9_even = digits[1] + digits[3] + digits[5] + digits[7];

    const digit10 = (d1_to_9_odd * 7 - d1_to_9_even) % 10;
    const expected10 = digit10 < 0 ? digit10 + 10 : digit10;
    if (expected10 !== digits[9]) return false;

    const sumFirst10 = digits.slice(0, 10).reduce((acc, curr) => acc + curr, 0);
    if (sumFirst10 % 10 !== digits[10]) return false;

    return true;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Geçerli bir 11 haneli T.C. Kimlik Numarası giriniz';
  }
}

export class CreateCustomerProfileDto {
  @ApiProperty({ description: 'Müşteri adı', example: 'Ahmet' })
  @IsString()
  @IsNotEmpty({ message: 'Ad alanı zorunludur' })
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ description: 'Müşteri soyadı', example: 'Yılmaz' })
  @IsString()
  @IsNotEmpty({ message: 'Soyad alanı zorunludur' })
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    description: 'Doğum tarihi (YYYY-MM-DD)',
    example: '1995-05-15',
  })
  @IsDateString({}, { message: 'Geçerli bir doğum tarihi (YYYY-MM-DD) giriniz' })
  birthDate: string;

  @ApiProperty({
    description: 'Sürücü belgesi veriliş tarihi (YYYY-MM-DD)',
    example: '2016-08-20',
  })
  @IsDateString({}, { message: 'Geçerli bir ehliyet tarihi (YYYY-MM-DD) giriniz' })
  licenseDate: string;

  @ApiProperty({
    description: '11 haneli T.C. Kimlik Numarası (AES-256-GCM ile şifrelenir, HMAC ile hashlenir)',
    example: '12345678901',
  })
  @IsString()
  @MinLength(11)
  @MaxLength(11)
  @Validate(IsTcKimlikNoConstraint)
  nationalId: string;
}

/// Müşteri profil güncellemesi (Ad, soyad, T.C. Kimlik No, doğum tarihi ve ehliyet tarihi ilk kayıt sonrası değiştirilemez!)
export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({
    description: 'Yeni e-posta adresi (Yalnızca iletişim bilgisi güncellenebilir; resmi kimlik alanları değiştirilemez)',
    example: 'yeni.eposta@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email?: string;
}

export class CustomerProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  birthDate: string;

  @ApiProperty()
  licenseDate: string;

  @ApiProperty({ description: 'Maskelenmiş T.C. Kimlik No (KVKK uyumlu)' })
  maskedNationalId: string;

  @ApiProperty()
  calculatedAge: number;

  @ApiProperty()
  calculatedLicenseYears: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
