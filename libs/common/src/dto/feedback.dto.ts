import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Display name', example: 'Ranjith K' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Star rating 1-5', example: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Feedback text', example: 'Great app for tea pest detection!' })
  @IsString()
  feedback: string;

  @ApiPropertyOptional({ description: 'User location (city/region)', example: 'Coimbatore, TN' })
  @IsOptional()
  @IsString()
  location?: string;
}
