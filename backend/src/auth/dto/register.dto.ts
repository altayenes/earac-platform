import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  Length,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Telefon numarası (+905XXXXXXXXX)',
    example: '+905551234567',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+90|0)?5\d{9}$/, {
    message: 'Geçerli bir Türkiye cep telefonu numarası giriniz',
  })
  phone: string;

  @ApiProperty({
    description: 'E-posta adresi',
    example: 'ahmet.yilmaz@example.com',
  })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email: string;

  @ApiProperty({
    description: 'Parola (En az 8 karakter, harf ve rakam içermelidir)',
    example: 'GuvenliParola123!',
  })
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalıdır' })
  @MaxLength(64)
  password: string;

  @ApiProperty({
    description: 'Telefon numarasına gönderilen 6 haneli doğrulama kodu',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'SMS doğrulama kodu 6 haneli olmalıdır' })
  smsCode: string;
}
