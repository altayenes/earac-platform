import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Kayıtlı telefon numarası (+905XXXXXXXXX veya 05XXXXXXXXX)',
    example: '+905000000001',
  })
  @IsString()
  @IsNotEmpty({ message: 'Telefon numarası zorunludur' })
  @Matches(/^(\+90|0)?5\d{9}$/, {
    message: 'Geçerli bir Türkiye cep telefonu numarası giriniz',
  })
  phone: string;

  @ApiProperty({
    description: 'Kullanıcı parolası',
    example: 'Admin123!Test',
  })
  @IsString()
  @IsNotEmpty({ message: 'Parola zorunludur' })
  password: string;
}
