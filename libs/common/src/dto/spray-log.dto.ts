import {
  IsString, IsEnum, IsOptional, IsBoolean,
  IsArray, ValidateNested, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompositionEntryDto {
  @IsString() chemical: string;
  @IsString() quantity: string;
  @IsString() unit: string;
}

export class CreateSprayLogDto {
  @IsDateString()
  date: string;

  @IsString()
  section: string;

  @IsOptional() @IsString()
  color?: string;

  @IsEnum(['hand', 'machine', 'drone'])
  sprayerType: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionEntryDto)
  composition: CompositionEntryDto[];

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsBoolean()
  completed?: boolean;

  @IsOptional() @IsString()
  localId?: string;
}

export class UpdateSprayLogDto {
  @IsOptional() @IsString()        section?: string;
  @IsOptional() @IsString()        color?: string;
  @IsOptional() @IsEnum(['hand', 'machine', 'drone']) sprayerType?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompositionEntryDto)
  composition?: CompositionEntryDto[];
  @IsOptional() @IsString()        notes?: string;
  @IsOptional() @IsBoolean()       completed?: boolean;
}

export class SyncSprayLogsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSprayLogDto)
  logs: CreateSprayLogDto[];
}
