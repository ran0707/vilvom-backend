import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback, FeedbackDocument } from '@app/database';
import { CreateFeedbackDto } from '@app/common';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(Feedback.name)
    private feedbackModel: Model<FeedbackDocument>,
  ) {}

  async createFeedback(dto: CreateFeedbackDto, userId?: string) {
    const feedback = new this.feedbackModel({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      name: dto.name,
      rating: dto.rating,
      feedback: dto.feedback,
      location: dto.location,
    });

    await feedback.save();
    this.logger.log(`Feedback saved: ${feedback.id} by ${dto.name}`);

    return { success: true, feedback: feedback.toJSON() };
  }

  async getPublicFeedbacks(limit = 20) {
    const feedbacks = await this.feedbackModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return { feedbacks: feedbacks.map((f) => f.toJSON()) };
  }

  async hasUserSubmittedFeedback(userId: string): Promise<boolean> {
    const count = await this.feedbackModel.countDocuments({
      userId: new Types.ObjectId(userId),
    });
    return count > 0;
  }
}
