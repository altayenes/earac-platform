import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateNamedEntityDto {
  @ApiProperty({ description: 'Referans verisi adı', example: 'Sedan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}

export class CreateModelDto {
  @ApiProperty({ description: 'Marka ID', example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty({ description: 'Model adı', example: 'Corolla' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}

export class ReferenceDataResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;
}

export class ModelResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  brandId: string;

  @ApiProperty()
  isActive: boolean;
}
