import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DroneRequestDocument = DroneRequest & Document;

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
export class DroneRequest {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop()
  guestName: string;

  @Prop()
  guestPhone: string;

  @Prop()
  guestEmail: string;

  @Prop({ required: true })
  serviceType: string;

  @Prop()
  customService: string;

  @Prop({ required: true })
  preferredDate: Date;

  @Prop({ required: true })
  preferredTime: string;

  @Prop({
    type: {
      farmName: String,
      location: { type: String, required: true },
      areaSize: Number,
      areaUnit: { type: String, default: 'acres' },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    required: true,
  })
  area: {
    farmName?: string;
    location: string;
    areaSize?: number;
    areaUnit: string;
    coordinates?: { lat: number; lng: number };
  };

  @Prop()
  cropType: string;

  @Prop()
  additionalNotes: string;

  @Prop({ default: 'medium' })
  urgency: string;

  @Prop({ default: 'pending' })
  status: string;

  @Prop()
  assignedOperator: string;

  @Prop()
  estimatedCost: number;

  @Prop()
  actualCost: number;

  @Prop({
    type: [{
      message: String,
      timestamp: { type: Date, default: Date.now },
      sender: { type: String, enum: ['user', 'operator', 'system'] },
    }],
  })
  communications: Array<{
    message: string;
    timestamp: Date;
    sender: 'user' | 'operator' | 'system';
  }>;

  @Prop()
  completedAt: Date;

  @Prop({
    type: {
      rating: Number,
      feedback: String,
      ratedAt: Date,
    },
  })
  serviceRating: {
    rating: number;
    feedback?: string;
    ratedAt: Date;
  };

  @Prop()
  notes: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const DroneRequestSchema = SchemaFactory.createForClass(DroneRequest);