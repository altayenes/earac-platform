import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  Length,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Kayıtlı telefon numarası',
    example: '+905551234567',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+90|0)?5\d{9}$/, {
    message: 'Geçerli bir Türkiye cep telefonu numarası giriniz',
  })
  phone: string;

  @ApiProperty({
    description: 'PASSWORD_RESET amacıyla gönderilen 6 haneli SMS kodu',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'SMS doğrulama kodu 6 haneli olmalıdır' })
  smsCode: string;

  @ApiProperty({
    description: 'Yeni parola (En az 8 karakter)',
    example: 'YeniGucluParola123!',
  })
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalıdır' })
  @MaxLength(64)
  newPassword: string;
}
