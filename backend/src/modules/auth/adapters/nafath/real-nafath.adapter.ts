import { Inject, Injectable, Optional } from '@nestjs/common';

import { authNafathProviderUnavailable } from '../../auth.errors';
import type {
  NafathAdapter,
  NafathOfficialClient,
  NafathVerifiedIdentity,
  NafathVerifyInput,
} from '../../types/auth.types';
import { NAFATH_OFFICIAL_CLIENT } from '../../types/auth.types';

/**
 * Production Nafath boundary.
 *
 * This repository does not contain the official Nafath request/response contract,
 * signing rules, or SDK. Until an official {@link NafathOfficialClient} is
 * registered, verification fails closed — never invents endpoints or treats a
 * client-supplied nationalId/code as proof of government identity.
 */
@Injectable()
export class RealNafathAdapter implements NafathAdapter {
  constructor(
    @Optional()
    @Inject(NAFATH_OFFICIAL_CLIENT)
    private readonly officialClient?: NafathOfficialClient,
  ) {}

  async verify(
    input: NafathVerifyInput,
  ): Promise<NafathVerifiedIdentity | null> {
    if (!this.officialClient) {
      throw authNafathProviderUnavailable();
    }

    return this.officialClient.verifyChallenge(input);
  }
}
