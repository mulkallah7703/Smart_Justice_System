import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/env.validation';
import type {
  NafathAdapter,
  NafathVerifiedIdentity,
  NafathVerifyInput,
} from '../../types/auth.types';

/**
 * DEVELOPMENT / TEST ONLY.
 * Compares the submitted challenge to MOCK_NAFATH_CODE / nafath.mockCode.
 * Must never be registered when NAFATH_MODE=real or NODE_ENV=production.
 */
@Injectable()
export class MockNafathAdapter implements NafathAdapter {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async verify(
    input: NafathVerifyInput,
  ): Promise<NafathVerifiedIdentity | null> {
    const nafath = this.configService.get('nafath', { infer: true });
    if (nafath.mode !== 'mock') {
      return null;
    }
    if (input.nafathCode !== nafath.mockCode) {
      return null;
    }
    return { nationalId: input.nationalId };
  }
}
