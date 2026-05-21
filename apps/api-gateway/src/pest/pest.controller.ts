import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { PestService } from './pest.service';
import { CreatePestDetectionDto } from '@app/common';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Pest Detection')
@Controller('pest')
export class PestController {
  constructor(private readonly pestService: PestService) {}

  @Post('detect')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Detect pest from uploaded image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/pest-images',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async detectPest(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() createPestDetectionDto: CreatePestDetectionDto,
    @GetUser() user?: any,
  ) {
    // Manual file type validation (more reliable)
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP images are allowed.`
      );
    }
    
    return this.pestService.detectPest(file, createPestDetectionDto, user?.userId);
  }

  @Get('detections')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user pest detections' })
  async getUserDetections(
    @GetUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pestService.getUserDetections(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('detections/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get detection details by ID' })
  async getDetectionById(
    @Param('id') detectionId: string,
    @GetUser('userId') userId: string,
  ) {
    return this.pestService.getDetectionById(detectionId, userId);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get pest management recommendations' })
  async getRecommendations(@Query('pestName') pestName?: string) {
    return this.pestService.getRecommendations(pestName);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby pest detections' })
  async getNearbyDetections(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.pestService.getNearbyDetections(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 10,
    );
  }

  @Patch('detections/:id')
  @ApiOperation({ summary: 'Update detection with location, questionnaire, and chat' })
  async updateDetection(
    @Param('id') detectionId: string,
    @Body() body: any,
  ) {
    // userId extracted manually so unauthenticated (guest) requests still work
    return this.pestService.updateDetection(detectionId, undefined, body);
  }

  @Get('statistics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user pest detection statistics' })
  async getUserStatistics(@GetUser('userId') userId: string) {
    return this.pestService.getUserStatistics(userId);
  }
}