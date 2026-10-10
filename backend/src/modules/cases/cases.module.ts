import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseCreateRateLimitGuard } from './guards/case-create-rate-limit.guard';

@Module({
  imports: [AuthModule],
  controllers: [CasesController],
  providers: [CasesService, CaseCreateRateLimitGuard],
})
export class CasesModule {}
