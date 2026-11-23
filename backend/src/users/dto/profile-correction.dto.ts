import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ChangePhoneDto {
  @ApiProperty({ description: 'Yeni telefon numarası', example: '+905551234567' })
  @IsString()
  @IsNotEmpty()
  newPhone: string;

  @ApiProperty({ description: 'Yeni telefona gönderilen 6 haneli SMS doğrulama kodu', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class VerifyEmailDto {
  @ApiPropertyOptional({ description: 'Doğrulanacak e-posta adresi (varsayılan mevcut e-posta)', example: 'ahmet@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Sandbox e-posta doğrulama kodu', example: '123456' })
  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateProfileCorrectionRequestDto {
  @ApiPropertyOptional({ description: 'Düzeltilecek ad', example: 'Ahmet' })
  @IsOptional()
  @IsString()
  requestedFirstName?: string;

  @ApiPropertyOptional({ description: 'Düzeltilecek soyad', example: 'Yılmaz' })
  @IsOptional()
  @IsString()
  requestedLastName?: string;

  @ApiPropertyOptional({ description: 'Düzeltilecek doğum tarihi (YYYY-MM-DD)', example: '1995-05-15' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Doğum tarihi YYYY-MM-DD formatında olmalıdır' })
  requestedBirthDate?: string;

  @ApiPropertyOptional({ description: 'Düzeltilecek ehliyet veriliş tarihi (YYYY-MM-DD)', example: '2015-06-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ehliyet tarihi YYYY-MM-DD formatında olmalıdır' })
  requestedLicenseDate?: string;

  @ApiPropertyOptional({ description: 'Düzeltilecek 11 haneli T.C. Kimlik No', example: '12345678901' })
  @IsOptional()
  @Length(11, 11, { message: 'T.C. Kimlik No 11 haneli olmalıdır' })
  @Matches(/^[1-9][0-9]{10}$/, { message: 'Geçersiz T.C. Kimlik No formatı' })
  requestedNationalId?: string;

  @ApiProperty({
    description: 'Düzeltme talebinin gerekçesi ve açıklaması',
    example: 'Nüfus cüzdanı yenilemesi ve ehliyet sınıfı güncellemesi nedeniyle düzeltme rica ediyorum.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReviewProfileCorrectionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], description: 'Talep inceleme sonucu' })
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Yönetici inceleme notu', example: 'Belgeler incelendi ve onaylandı.' })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class ProfileCorrectionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'], description: 'Durum filtresi' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Kullanıcı ID filtresi' })
  @IsOptional()
  @IsString()
  userId?: string;
}
