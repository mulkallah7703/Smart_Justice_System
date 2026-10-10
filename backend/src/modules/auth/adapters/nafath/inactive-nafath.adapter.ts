import { Injectable } from '@nestjs/common';

import { authNafathProviderUnavailable } from '../../auth.errors';
import type {
  NafathAdapter,
  NafathVerifiedIdentity,
  NafathVerifyInput,
} from '../../types/auth.types';

/**
 * Production-safe deferred Nafath adapter.
 * Does not call any government API. Active auth remains email/password.
 */
@Injectable()
export class InactiveNafathAdapter implements NafathAdapter {
  async verify(_input: NafathVerifyInput): Promise<NafathVerifiedIdentity | null> {
    throw authNafathProviderUnavailable();
  }
}
