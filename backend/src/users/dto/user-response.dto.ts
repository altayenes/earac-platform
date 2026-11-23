import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CustomerProfileResponseDto } from './customer-profile.dto';

export class StaffPermissionResponseDto {
  @ApiProperty()
  canManageVehicles: boolean;

  @ApiProperty()
  canManageReservations: boolean;

  @ApiProperty()
  canManageUsers: boolean;

  @ApiProperty()
  canManageBranches: boolean;

  @ApiProperty()
  canManagePricing: boolean;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: '+905551234567' })
  phone: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ type: () => CustomerProfileResponseDto })
  customerProfile?: CustomerProfileResponseDto | null;

  @ApiPropertyOptional({ type: () => StaffPermissionResponseDto })
  staffPermission?: StaffPermissionResponseDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
