import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

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
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'info' })
  type: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  actionUrl: string;

  @Prop({ type: Object })
  data: Record<string, any>;

  @Prop({ default: 'push' })
  channel: string;

  @Prop()
  scheduledFor: Date;

  @Prop()
  sentAt: Date;

  @Prop({ default: false })
  isDelivered: boolean;

  @Prop()
  deliveryStatus: string;

  @Prop()
  fcmToken: string;

  @Prop({ default: 'normal' })
  priority: string;

  @Prop()
  imageUrl: string;

  @Prop({
    type: [{
      action: String,
      label: String,
      url: String,
    }],
  })
  actions: Array<{
    action: string;
    label: string;
    url?: string;
  }>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);