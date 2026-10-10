import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './config/env.validation';
import { AiAdvisorModule } from './modules/ai/ai-advisor.module';
import { AiGuideModule } from './modules/ai/guide/ai-guide.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { JudicialCardModule } from './modules/judicial-card/judicial-card.module';
import { KioskModule } from './modules/kiosk/kiosk.module';
import { LawyersModule } from './modules/lawyers/lawyers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './shared/cache/redis.module';
import { DatabaseModule } from './shared/database/database.module';
import { LoggingModule } from './shared/logging/logging.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      load: [configuration],
    }),
    LoggingModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CasesModule,
    DocumentsModule,
    LawyersModule,
    ConsultationsModule,
    PaymentsModule,
    AlertsModule,
    KioskModule,
    JudicialCardModule,
    // Enqueues and reads AI jobs only. The processor lives in the worker
    // process, so the API never executes AI work.
    AiAdvisorModule,
    AiGuideModule,
  ],
})
export class AppModule {}
