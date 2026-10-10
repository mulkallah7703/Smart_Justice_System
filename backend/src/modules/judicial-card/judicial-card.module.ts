import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CardTierService } from './card-tier.service';
import { JudicialCardController } from './judicial-card.controller';
import { JudicialCardService } from './judicial-card.service';
import { QrGeneratorService } from './qr-generator.service';

@Module({
  imports: [AuthModule],
  controllers: [JudicialCardController],
  providers: [JudicialCardService, QrGeneratorService, CardTierService],
  exports: [JudicialCardService],
})
export class JudicialCardModule {}
