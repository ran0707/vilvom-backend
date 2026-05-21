import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '@app/database';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PestModule } from './pest/pest.module';
import { DroneModule } from './drone/drone.module';
import { SprayLogModule } from './spray-log/spray-log.module';
import { AdminModule } from './admin/admin.module';
import { FeedbackModule } from './feedback/feedback.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UserModule,
    PestModule,
    DroneModule,
    SprayLogModule,
    AdminModule,
    FeedbackModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}