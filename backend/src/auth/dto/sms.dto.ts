import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsIn, Length } from 'class-validator';

export class SendSmsDto {
  @ApiProperty({
    description: 'Türkiye formatında telefon numarası (+905XXXXXXXXX veya 05XXXXXXXXX)',
    example: '+905551234567',
  })
  @IsString()
  @IsNotEmpty({ message: 'Telefon numarası zorunludur' })
  @Matches(/^(\+90|0)?5\d{9}$/, {
    message: 'Geçerli bir Türkiye cep telefonu numarası giriniz (+905XXXXXXXXX)',
  })
  phone: string;

  @ApiProperty({
    description: 'SMS gönderim amacı',
    enum: ['REGISTER', 'LOGIN', 'PASSWORD_RESET'],
    example: 'REGISTER',
  })
  @IsString()
  @IsIn(['REGISTER', 'LOGIN', 'PASSWORD_RESET'], {
    message: 'Geçerli bir amaç giriniz (REGISTER, LOGIN, PASSWORD_RESET)',
  })
  purpose: 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';
}

export class VerifySmsDto {
  @ApiProperty({
    description: 'Telefon numarası',
    example: '+905551234567',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+90|0)?5\d{9}$/, {
    message: 'Geçerli bir Türkiye cep telefonu numarası giriniz',
  })
  phone: string;

  @ApiProperty({
    description: '6 haneli SMS doğrulama kodu',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'Doğrulama kodu 6 haneli olmalıdır' })
  code: string;

  @ApiProperty({
    description: 'SMS gönderim amacı',
    enum: ['REGISTER', 'LOGIN', 'PASSWORD_RESET'],
    example: 'REGISTER',
  })
  @IsString()
  @IsIn(['REGISTER', 'LOGIN', 'PASSWORD_RESET'])
  purpose: 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';
}
