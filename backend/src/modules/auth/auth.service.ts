import { createHash, randomBytes, randomUUID } from 'crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type Role } from '@prisma/client';

import { AppError } from '../../shared/exceptions/app-error';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  authInvalidCredentials,
  authInvalidNationalId,
  authNafathFailed,
  authWeakPassword,
  userNotFound,
} from './auth.errors';
import { isValidNationalId } from './national-id';
import { PasswordService } from './password.service';
import { NAFATH_ADAPTER } from './types/auth.types';
import type {
  AuthVerifyResult,
  JwtPayload,
  NafathAdapter,
} from './types/auth.types';

const CARD_VALIDITY_YEARS = 5;
const CARD_NUMBER_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;

export interface AuthRegisterResult {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(NAFATH_ADAPTER) private readonly nafathAdapter: NafathAdapter,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthRegisterResult> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const password = input.password;

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw authWeakPassword();
    }

    const passwordHash = await this.passwordService.hash(password);
    const phone = this.syntheticPhone(`email:${email}`);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name,
            email,
            phone,
            passwordHash,
            role: 'CITIZEN',
          },
        });
        await this.createCardHandlingConflict(tx, created.id);
        return created;
      });

      await this.safeAudit({
        action: 'AUTH_REGISTER_SUCCESS',
        actorUserId: user.id,
        resourceId: user.id,
      });

      this.logger.log(`Registration succeeded for user ${user.id}`);

      return {
        id: user.id,
        name: user.name,
        email: user.email as string,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Anti-enumeration: same HTTP success shape as a new registration.
        // No second account is created; timing is aligned via verifyDummy.
        await this.passwordService.verifyDummy(password);
        await this.safeAudit({
          action: 'AUTH_REGISTER_DUPLICATE_SUPPRESSED',
          reason: 'EMAIL_CONFLICT',
        });
        this.logger.log('Registration conflict suppressed (anti-enumeration)');
        return {
          id: randomUUID(),
          name,
          email,
        };
      }
      throw error;
    }
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<AuthVerifyResult> {
    const email = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: {
        id: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      await this.passwordService.verifyDummy(input.password);
      await this.safeAudit({
        action: 'AUTH_LOGIN_FAILED',
        reason: 'INVALID_CREDENTIALS',
      });
      throw authInvalidCredentials();
    }

    const accepted = await this.passwordService.verify(
      user.passwordHash,
      input.password,
    );
    if (!accepted) {
      await this.safeAudit({
        action: 'AUTH_LOGIN_FAILED',
        reason: 'INVALID_CREDENTIALS',
      });
      throw authInvalidCredentials();
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    } satisfies JwtPayload);

    await this.safeAudit({
      action: 'AUTH_LOGIN_SUCCESS',
      actorUserId: user.id,
      resourceId: user.id,
    });

    this.logger.log(`Password authentication succeeded for user ${user.id}`);

    return { accessToken };
  }

  /**
   * FUTURE / DISABLED for active UI — kept for official Nafath integration.
   * Not used by Login/Register screens.
   */
  async verifyNafath(
    nationalId: string,
    nafathCode: number,
    requestMeta: { ip?: string; userAgent?: string },
  ): Promise<AuthVerifyResult> {
    if (!isValidNationalId(nationalId)) {
      await this.safeAudit({
        action: 'AUTH_LOGIN_FAILED',
        reason: 'INVALID_NATIONAL_ID',
        ip: requestMeta.ip,
        userAgent: requestMeta.userAgent,
      });
      throw authInvalidNationalId();
    }

    let identity;
    try {
      identity = await this.nafathAdapter.verify({ nationalId, nafathCode });
    } catch (error) {
      if (error instanceof AppError) {
        await this.safeAudit({
          action: 'AUTH_LOGIN_FAILED',
          reason: error.code,
          ip: requestMeta.ip,
          userAgent: requestMeta.userAgent,
        });
        throw error;
      }
      this.logger.warn('Nafath provider verification failed with sanitized error');
      await this.safeAudit({
        action: 'AUTH_LOGIN_FAILED',
        reason: 'PROVIDER_ERROR',
        ip: requestMeta.ip,
        userAgent: requestMeta.userAgent,
      });
      throw authNafathFailed();
    }

    if (!identity) {
      await this.safeAudit({
        action: 'AUTH_LOGIN_FAILED',
        reason: 'INVALID_CHALLENGE',
        ip: requestMeta.ip,
        userAgent: requestMeta.userAgent,
      });
      throw authNafathFailed();
    }

    if (!isValidNationalId(identity.nationalId)) {
      await this.safeAudit({
        action: 'AUTH_LOGIN_FAILED',
        reason: 'PROVIDER_IDENTITY_INVALID',
        ip: requestMeta.ip,
        userAgent: requestMeta.userAgent,
      });
      throw authNafathFailed();
    }

    const user = await this.commitUserAndCard(identity.nationalId);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    } satisfies JwtPayload);

    await this.safeAudit({
      action: 'AUTH_LOGIN_SUCCESS',
      actorUserId: user.id,
      resourceId: user.id,
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent,
    });

    this.logger.log(`Authentication succeeded for user ${user.id}`);

    return { accessToken };
  }

  signAccessToken(userId: string, role: Role): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      role,
    } satisfies JwtPayload);
  }

  private async commitUserAndCard(
    nationalId: string,
  ): Promise<{ id: string; role: Role }> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.findOrCreateUserWithCard(tx, nationalId),
          { maxWait: 5000, timeout: 10000 },
        );
      } catch (error) {
        lastError = error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034')
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  private async findOrCreateUserWithCard(
    tx: Prisma.TransactionClient,
    nationalId: string,
  ): Promise<{ id: string; role: Role }> {
    const user = await tx.user.upsert({
      where: { nationalId },
      create: {
        nationalId,
        name: 'Citizen',
        phone: this.syntheticPhone(nationalId),
        role: 'CITIZEN',
      },
      update: {},
      include: { judicialCard: true },
    });

    if (user.deletedAt) {
      throw userNotFound();
    }

    if (!user.judicialCard) {
      await this.createCardHandlingConflict(tx, user.id);
    }

    return { id: user.id, role: user.role };
  }

  private async createCardHandlingConflict(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const validUntil = new Date();
    validUntil.setUTCFullYear(validUntil.getUTCFullYear() + CARD_VALIDITY_YEARS);

    for (let attempt = 0; attempt < CARD_NUMBER_ATTEMPTS; attempt += 1) {
      try {
        await tx.judicialCard.upsert({
          where: { userId },
          create: {
            userId,
            cardNumber: this.generateCardNumber(),
            tier: 'NORMAL',
            discountPct: 0,
            validUntil,
            qrKeyId: `qk_${randomBytes(8).toString('hex')}`,
          },
          update: {},
        });
        return;
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }

        const existing = await tx.judicialCard.findUnique({
          where: { userId },
        });
        if (existing) {
          return;
        }
      }
    }

    throw new Error('Unable to allocate a unique judicial card number');
  }

  private generateCardNumber(): string {
    const year = new Date().getUTCFullYear();
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `JC-${year}-${suffix}`;
  }

  private syntheticPhone(seed: string): string {
    const digest = createHash('sha256').update(seed).digest();
    const digits = Array.from(digest)
      .map((byte) => String(byte % 10))
      .join('')
      .slice(0, 7);
    return `050${digits}`;
  }

  private async safeAudit(input: {
    action:
      | 'AUTH_LOGIN_SUCCESS'
      | 'AUTH_LOGIN_FAILED'
      | 'AUTH_REGISTER_SUCCESS'
      | 'AUTH_REGISTER_DUPLICATE_SUPPRESSED';
    reason?: string;
    actorUserId?: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: input.actorUserId ? 'USER' : 'SYSTEM',
          actorUserId: input.actorUserId,
          action: input.action,
          resourceType: 'Auth',
          resourceId: input.resourceId,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: input.reason ? { reason: input.reason } : undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write auth audit log: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
