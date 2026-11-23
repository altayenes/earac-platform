import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UsersController,
  AdminStaffController,
  AdminProfileCorrectionController,
} from './users.controller';

@Module({
  controllers: [
    UsersController,
    AdminStaffController,
    AdminProfileCorrectionController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
