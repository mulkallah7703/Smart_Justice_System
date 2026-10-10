import type { Role } from '@prisma/client';

export const NAFATH_ADAPTER = Symbol('NAFATH_ADAPTER');

/**
 * Optional plug-in for the official government Nafath HTTP/OIDC client.
 * Not registered until the official contract and credentials are supplied.
 * Implementations must never invent endpoints or trust browser redirects alone.
 */
export const NAFATH_OFFICIAL_CLIENT = Symbol('NAFATH_OFFICIAL_CLIENT');

export interface NafathVerifyInput {
  nationalId: string;
  nafathCode: number;
}

/**
 * Identity claims verified by the Nafath provider. Application code must use
 * `nationalId` from this object — never a client-supplied userId.
 */
export interface NafathVerifiedIdentity {
  nationalId: string;
}

export interface NafathAdapter {
  /**
   * Verifies an identity challenge with the configured provider.
   * Returns null when the challenge is rejected.
   * Implementations must not log nationalId or the challenge code.
   */
  verify(input: NafathVerifyInput): Promise<NafathVerifiedIdentity | null>;
}

/**
 * Official client seam. Wired only when the SDAIA/Nafath integration guide and
 * credentials are available in the deployment environment.
 */
export interface NafathOfficialClient {
  verifyChallenge(
    input: NafathVerifyInput,
  ): Promise<NafathVerifiedIdentity | null>;
}

export interface JwtPayload {
  sub: string;
  role: Role;
}

export interface AuthenticatedUser {
  sub: string;
  role: Role;
}

export interface AuthVerifyResult {
  accessToken: string;
}
