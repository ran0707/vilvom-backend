import {
  IsString, IsNumber, IsOptional, IsEnum, IsDateString,
  IsObject, ValidateNested, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CoordinatesDto {
  @ApiProperty()  @IsNumber() lat: number;
  @ApiProperty()  @IsNumber() lng: number;
}

class AreaDto {
  @ApiPropertyOptional() @IsOptional() @IsString()              farmName?: string;
  @ApiProperty()         @IsString()                            location: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber()              areaSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsString()              areaUnit?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateNested()
  @Type(() => CoordinatesDto)                                   coordinates?: CoordinatesDto;
}

export class CreateDroneRequestDto {
  @ApiProperty({
    enum: ['pesticide_spraying', 'fertilizer_application', 'field_monitoring', 'crop_mapping', 'soil_analysis'],
  })
  @IsString()
  serviceType: string;

  @ApiProperty()
  @IsDateString()
  preferredDate: string;

  @ApiProperty()
  @IsString()
  preferredTime: string;

  @ApiProperty({ type: AreaDto })
  @ValidateNested()
  @Type(() => AreaDto)
  area: AreaDto;

  @ApiPropertyOptional() @IsOptional() @IsString() cropType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() additionalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customService?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  urgency?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() guestName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guestPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guestEmail?: string;
}

export class UpdateDroneRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledDate?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional() @IsEnum(['low', 'medium', 'high', 'urgent']) urgency?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled'])
  status?: string;
}
