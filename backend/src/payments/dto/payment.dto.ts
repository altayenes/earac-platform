import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { PaymentStatus, PaymentType } from '@prisma/client';

export class ProcessPaymentDto {
  @ApiProperty({ description: 'Ödemesi yapılacak rezervasyon ID', example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({
    description: 'Ağ kesintilerinde mükerrer tahsilatı önleyen tekil anahtar (UUID veya sipariş kodu)',
    example: 'idem_charge_12345678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Simülasyon: Kart Sahibi Adı', example: 'Ahmet Yılmaz' })
  @IsOptional()
  @IsString()
  cardHolderName?: string;

  @ApiPropertyOptional({ description: 'Simülasyon: 16 Haneli Kart No', example: '4543600000000001' })
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiPropertyOptional({ description: 'Simülasyon: Son Kullanma Ay (MM)', example: '12' })
  @IsOptional()
  @IsString()
  expireMonth?: string;

  @ApiPropertyOptional({ description: 'Simülasyon: Son Kullanma Yıl (YY)', example: '28' })
  @IsOptional()
  @IsString()
  expireYear?: string;

  @ApiPropertyOptional({ description: 'Simülasyon: CVV', example: '123' })
  @IsOptional()
  @IsString()
  cvv?: string;

  @ApiPropertyOptional({
    description: 'Sandbox Test Bayrağı: True gönderilirse başarısız ödeme (PAYMENT_FAILED) simüle edilir',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}

export class ReconcileLatePaymentDto {
  @ApiProperty({ description: 'Geç ödeme yapılan veya uzlaştırılacak rezervasyon ID', example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({
    description: 'Ödeme sağlayıcısının işlem veya webhook referansı',
    example: 'prov_late_12345678',
  })
  @IsString()
  @IsNotEmpty()
  providerRef: string;

  @ApiProperty({
    description: 'Ağ kesintilerinde mükerrer işlemi önleyen tekil anahtar',
    example: 'idemp_late_12345678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;
}

export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reservationId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ example: 'TRY' })
  currency: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ enum: PaymentType })
  type: PaymentType;

  @ApiProperty()
  idempotencyKey: string;

  @ApiPropertyOptional()
  providerRef: string | null;

  @ApiProperty()
  createdAt: Date;
}
