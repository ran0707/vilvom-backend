import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from '@app/common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Submit app feedback/review' })
  async createFeedback(
    @Body() dto: CreateFeedbackDto,
    @GetUser() user?: any,
  ) {
    return this.feedbackService.createFeedback(dto, user?.userId);
  }

  @Get('public')
  @ApiOperation({ summary: 'Get public feedback list for HomeTab cards' })
  async getPublicFeedbacks(
    @Query('limit') limit?: string,
  ) {
    return this.feedbackService.getPublicFeedbacks(limit ? parseInt(limit, 10) : 20);
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if authenticated user has submitted feedback' })
  async checkUserFeedback(@GetUser() user: any) {
    const submitted = await this.feedbackService.hasUserSubmittedFeedback(user.userId);
    return { submitted };
  }
}
