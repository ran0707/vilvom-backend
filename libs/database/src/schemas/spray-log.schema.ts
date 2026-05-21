import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SprayLogDocument = SprayLog & Document;

@Schema({
  collection: 'spraylogs',
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
export class SprayLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true })
  section: string;

  @Prop()
  color: string;

  @Prop({ required: true, enum: ['hand', 'machine', 'drone'] })
  sprayerType: string;

  @Prop({
    type: [{ chemical: String, quantity: String, unit: String }],
    default: [],
  })
  composition: Array<{ chemical: string; quantity: string; unit: string }>;

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: false })
  completed: boolean;

  @Prop()
  localId: string; // device-side ID used for upsert sync
}

export const SprayLogSchema = SchemaFactory.createForClass(SprayLog);

// Index for fast per-user date queries
SprayLogSchema.index({ userId: 1, date: 1 });
SprayLogSchema.index({ userId: 1, localId: 1 }, { unique: true, sparse: true });
