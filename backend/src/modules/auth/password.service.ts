import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP-aligned Argon2id parameters (pinned — do not rely on library defaults). */
export const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * Dummy hash used only to equalize login timing when the account is missing.
 * Generated once at module load with the same parameters as real hashes.
 */
let dummyHashPromise: Promise<string> | null = null;

const getDummyHash = (): Promise<string> => {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash('phase-v-dummy-password-not-a-secret', {
      ...ARGON2_OPTIONS,
    });
  }
  return dummyHashPromise;
};

/**
 * Argon2id password hashing. Never log plaintext or hashes.
 */
@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { ...ARGON2_OPTIONS });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Runs a full Argon2id verify against a dummy hash so missing-user login
   * paths spend similar CPU time to real verifications.
   */
  async verifyDummy(password: string): Promise<void> {
    const dummy = await getDummyHash();
    try {
      await argon2.verify(dummy, password);
    } catch {
      // Ignore verify failures — purpose is timing only.
    }
  }
}
