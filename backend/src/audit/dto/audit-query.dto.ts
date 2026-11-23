import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { AuditAction } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AuditLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AuditAction, description: 'Denetim eylemi filtresi' })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'İşlemi yapan kullanıcı ID' })
  @IsOptional()
  @IsString()
  performedByUserId?: string;

  @ApiPropertyOptional({ description: 'İlgili rezervasyon ID' })
  @IsOptional()
  @IsString()
  reservationId?: string;
}
