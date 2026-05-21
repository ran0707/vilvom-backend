import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop()
  password: string;

  @Prop({ default: false })
  isPhoneVerified: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  isDeviceBound: boolean;

  @Prop({
    type: {
      deviceId: String,
      deviceModel: String,
      systemVersion: String,
      appVersion: String,
      platform: String,
    },
  })
  deviceInfo: {
    deviceId: string;
    deviceModel: string;
    systemVersion: string;
    appVersion: string;
    platform: string;
  };

  @Prop({
    type: {
      fullName: String,
      dateOfBirth: Date,
      address: String,
      occupation: String,
      bio: String,
      profileImage: String,
    },
  })
  profileInfo: {
    fullName?: string;
    dateOfBirth?: Date;
    address?: string;
    occupation?: string;
    bio?: string;
    profileImage?: string;
  };

  @Prop()
  profileImage: string;

  @Prop({ default: Date.now })
  lastPasswordChange: Date;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({
    type: {
      lat: Number,
      lng: Number,
      address: String,
      city: String,
      state: String,
      country: String,
    },
  })
  location: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };

  @Prop({ default: Date.now })
  lastLogin: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);