import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

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
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ unique: true, required: true })
  orderNumber: string;

  @Prop({
    type: [{
      productId: String,
      name: String,
      description: String,
      quantity: Number,
      price: Number,
      image: String,
    }],
    required: true,
  })
  items: Array<{
    productId: string;
    name: string;
    description: string;
    quantity: number;
    price: number;
    image?: string;
  }>;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ default: 0 })
  taxAmount: number;

  @Prop({ default: 0 })
  shippingAmount: number;

  @Prop({ required: true })
  finalAmount: number;

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ default: 'cash_on_delivery' })
  paymentMethod: string;

  @Prop({ default: 'pending' })
  paymentStatus: string;

  @Prop()
  paymentId: string;

  @Prop({
    type: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    required: true,
  })
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };

  @Prop({
    type: [{
      status: String,
      message: String,
      timestamp: { type: Date, default: Date.now },
      location: String,
    }],
  })
  trackingHistory: Array<{
    status: string;
    message: string;
    timestamp: Date;
    location?: string;
  }>;

  @Prop()
  estimatedDeliveryDate: Date;

  @Prop()
  actualDeliveryDate: Date;

  @Prop()
  trackingNumber: string;

  @Prop()
  deliveryPartner: string;

  @Prop({
    type: {
      rating: Number,
      review: String,
      reviewedAt: Date,
    },
  })
  customerReview: {
    rating: number;
    review?: string;
    reviewedAt: Date;
  };
}

export const OrderSchema = SchemaFactory.createForClass(Order);