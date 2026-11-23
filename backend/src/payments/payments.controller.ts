import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  ProcessPaymentDto,
  PaymentResponseDto,
  ReconcileLatePaymentDto,
} from './dto/payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: 'Rezervasyon Ödemesini Alır (Sandbox Simülasyonu & Idempotency Korumalı)',
    description:
      'idempotencyKey zorunludur. Aynı anahtar tekrar gönderildiğinde mükerrer tahsilat yapılmaz, ilk işlemin sonucu döner. Başarılı ödemede rezervasyon otomatik CONFIRMED durumuna geçer ve 15 dk bloke kaldırılır.',
  })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  @Post('charge')
  @HttpCode(HttpStatus.OK)
  async charge(
    @CurrentUser('sub') userId: string,
    @Body() dto: ProcessPaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.processPayment(userId, dto);
  }

  @ApiOperation({
    summary: 'Geç Düşen Ödeme Uzlaştırması (Late Payment Reconciliation)',
    description:
      'EXPIRED veya zaman aşımına uğramış rezervasyonlara geç gelen ödemelerde atomik advisory lock ile şube kapasitesini denetler. Kapasite varsa CONFIRMED yapar; kapasite dolmuşsa otomatik tam REFUND uygular.',
  })
  @Post('reconcile-late')
  @HttpCode(HttpStatus.OK)
  async reconcileLate(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() dto: ReconcileLatePaymentDto,
  ) {
    return this.paymentsService.reconcileLatePayment(user.sub, user.role, dto);
  }

  @ApiOperation({ summary: 'Bir rezervasyona ait ödeme ve iade geçmişini listeler' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  @Get('reservation/:reservationId')
  async getPaymentsByReservation(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('reservationId') reservationId: string,
  ): Promise<PaymentResponseDto[]> {
    return this.paymentsService.getPaymentsByReservation(
      reservationId,
      user.sub,
      user.role,
    );
  }
}
