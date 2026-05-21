import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PestDetection, PestDetectionSchema } from '@app/database';
import { PestController } from './pest.controller';
import { PestService } from './pest.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PestDetection.name, schema: PestDetectionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [PestController],
  providers: [PestService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [PestService],
})
export class PestModule {}