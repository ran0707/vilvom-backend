import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PestDetectionDocument = PestDetection & Document;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class PestDetection {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop()
  guestId: string;

  @Prop({ required: true })
  pestName: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ type: [Number] })
  boundingBox: number[];

  @Prop({ type: [String], default: [] })
  symptoms: string[];

  @Prop({ type: [String], default: [] })
  biological_control: string[];

  @Prop({ type: [String], default: [] })
  chemical_control: string[];

  @Prop({ type: [String], default: [] })
  mechanical_control: string[];

  @Prop()
  severity: string;

  // Use Object type to avoid Mongoose misinterpreting the nested 'type' key in GeoJSON.
  // The 2dsphere index below handles geo queries; documents must contain valid GeoJSON Point.
  @Prop({ type: Object })
  location: {
    type: string;
    coordinates: number[];
  } | null;

  @Prop()
  processed_image: string;

  @Prop()
  original_image: string;

  @Prop({ type: Object })
  meta: Record<string, any>;

  @Prop({
    type: [{
      question: String,
      answer: String,
      timestamp: { type: Date, default: Date.now },
    }],
  })
  questionnaire: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>;

  @Prop({
    type: [{
      role: { type: String, enum: ['user', 'assistant'] },
      text: String,
      timestamp: { type: Date, default: Date.now },
    }],
  })
  chat: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
  }>;

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ type: Date })
  detectedAt: Date;
}

export const PestDetectionSchema = SchemaFactory.createForClass(PestDetection);
// 2dsphere index enables $near queries; sparse so records without location are skipped
PestDetectionSchema.index({ location: '2dsphere' }, { sparse: true });