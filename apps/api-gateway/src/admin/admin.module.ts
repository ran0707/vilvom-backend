import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema, PestDetection, PestDetectionSchema, DroneRequest, DroneRequestSchema, SprayLog, SprayLogSchema } from '@app/database';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name,          schema: UserSchema          },
      { name: PestDetection.name, schema: PestDetectionSchema },
      { name: DroneRequest.name,  schema: DroneRequestSchema  },
      { name: SprayLog.name,      schema: SprayLogSchema      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => ({
        secret:       cs.get<string>('JWT_SECRET'),
        signOptions:  { expiresIn: cs.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController],
  providers:   [AdminService, JwtAuthGuard, AdminGuard],
})
export class AdminModule {}
