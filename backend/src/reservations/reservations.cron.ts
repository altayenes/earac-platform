import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationsService } from './reservations.service';

@Injectable()
export class ReservationCronService {
  private readonly logger = new Logger(ReservationCronService.name);

  constructor(private reservationsService: ReservationsService) {}

  // Every 5 minutes: Check and expire stale PENDING_PAYMENT reservations
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredReservations() {
    try {
      await this.reservationsService.expirePendingReservations();
    } catch (error) {
      this.logger.error('Failed to run expirePendingReservations cron job', error);
    }
  }
}
