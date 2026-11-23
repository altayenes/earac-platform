import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import {
  ReservationsController,
  AdminReservationsController,
} from './reservations.controller';
import { ReservationCronService } from './reservations.cron';

@Module({
  controllers: [ReservationsController, AdminReservationsController],
  providers: [ReservationsService, ReservationCronService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
