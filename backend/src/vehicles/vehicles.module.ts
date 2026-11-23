import { Module } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import {
  VehiclesController,
  AdminVehiclesController,
} from './vehicles.controller';

@Module({
  controllers: [VehiclesController, AdminVehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
