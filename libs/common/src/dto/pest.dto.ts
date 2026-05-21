import { IsString, IsOptional, IsObject, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LocationDto {
  @ApiProperty({ description: 'Location type', example: 'Point' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Coordinates [longitude, latitude]', example: [80.2707, 13.0827] })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

class BoundingBoxDto {
  @ApiProperty({ description: 'X coordinate', example: 100 })
  @IsNumber()
  x: number;

  @ApiProperty({ description: 'Y coordinate', example: 100 })
  @IsNumber()
  y: number;

  @ApiProperty({ description: 'Width', example: 200 })
  @IsNumber()
  width: number;

  @ApiProperty({ description: 'Height', example: 150 })
  @IsNumber()
  height: number;
}

class QuestionnaireDto {
  @ApiProperty({ description: 'Question ID', example: 'q1' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Question text', example: 'What symptoms do you observe?' })
  @IsString()
  question: string;

  @ApiProperty({ description: 'Answer', example: 'Leaf holes and defoliation' })
  @IsString()
  answer: string;

  @ApiPropertyOptional({ description: 'Answer type', example: 'text' })
  @IsOptional()
  @IsString()
  type?: string;
}

class ChatMessageDto {
  @ApiProperty({ description: 'Message ID', example: 'msg_1' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Sender role', example: 'user' })
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @ApiProperty({ description: 'Message content', example: 'Can you provide more details about the treatment?' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Timestamp', example: '2024-01-15T10:30:00Z' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class CreatePestDetectionDto {
  @ApiPropertyOptional({ description: 'User ID (for authenticated users)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Guest ID (for anonymous users)' })
  @IsOptional()
  @IsString()
  guestId?: string;

  @ApiPropertyOptional({ description: 'Suspected pest name' })
  @IsOptional()
  @IsString()
  pestName?: string;

  @ApiPropertyOptional({ description: 'Detection confidence score' })
  @IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiPropertyOptional({ description: 'Bounding box coordinates', type: BoundingBoxDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  boundingBox?: BoundingBoxDto;

  @ApiPropertyOptional({ description: 'List of pest symptoms', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional({ description: 'Biological control methods', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  biological_control?: string[];

  @ApiPropertyOptional({ description: 'Chemical control methods', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chemical_control?: string[];

  @ApiPropertyOptional({ description: 'Mechanical control methods', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mechanical_control?: string[];

  @ApiPropertyOptional({ description: 'Severity level' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Processed image (base64)' })
  @IsOptional()
  @IsString()
  processed_image?: string;

  @ApiPropertyOptional({ description: 'Original image (base64)' })
  @IsOptional()
  @IsString()
  original_image?: string;

  @ApiPropertyOptional({ description: 'Location where pest was detected (GeoJSON Point)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return undefined; }
    }
    return value;
  })
  @IsObject()
  location?: { type: string; coordinates: number[] };

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Questionnaire responses', type: [QuestionnaireDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionnaireDto)
  questionnaire?: QuestionnaireDto[];

  @ApiPropertyOptional({ description: 'Chat messages', type: [ChatMessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  chat?: ChatMessageDto[];
}

export class PestDetectionQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by pest name' })
  @IsOptional()
  @IsString()
  pestName?: string;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Minimum confidence score' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minConfidence?: number;
}

export class NearbyDetectionsQueryDto {
  @ApiProperty({ description: 'Latitude', example: 13.0827 })
  @IsNumber()
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 80.2707 })
  @IsNumber()
  @Type(() => Number)
  lng: number;

  @ApiPropertyOptional({ description: 'Search radius in kilometers', example: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number = 10;

  @ApiPropertyOptional({ description: 'Number of days to look back', example: 30 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  days?: number = 30;
}