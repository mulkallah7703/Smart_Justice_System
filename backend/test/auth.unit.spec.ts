import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { decode, sign, verify } from 'jsonwebtoken';

import {
  parseNafath,
  type AppConfig,
} from '../src/config/env.validation';
import { MockNafathAdapter } from '../src/modules/auth/adapters/nafath/mock-nafath.adapter';
import { RealNafathAdapter } from '../src/modules/auth/adapters/nafath/real-nafath.adapter';
import {
  authInvalidNationalId,
  authInvalidToken,
  authNafathFailed,
  authNafathProviderUnavailable,
  authUnauthorized,
  userNotFound,
} from '../src/modules/auth/auth.errors';
import { AuthService } from '../src/modules/auth/auth.service';
import { isValidNationalId } from '../src/modules/auth/national-id';
import type {
  NafathAdapter,
  NafathOfficialClient,
} from '../src/modules/auth/types/auth.types';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('national ID validation', () => {
  it('accepts a 10-digit ID starting with 1 or 2', () => {
    expect(isValidNationalId('1999999991')).toBe(true);
    expect(isValidNationalId('2999999991')).toBe(true);
  });

  it('rejects invalid length, prefix, and non-numeric values', () => {
    expect(isValidNationalId('0999999991')).toBe(false);
    expect(isValidNationalId('199999999')).toBe(false);
    expect(isValidNationalId('19999999911')).toBe(false);
    expect(isValidNationalId('1abcdefghi')).toBe(false);
    expect(isValidNationalId('')).toBe(false);
  });
});

describe('parseNafath', () => {
  it('defaults to mock mode outside production', () => {
    expect(parseNafath({}, 'development')).toEqual({
      mode: 'mock',
      mockCode: 72,
      clientId: null,
      clientSecret: null,
      baseUrl: null,
    });
  });

  it('rejects NAFATH_MODE=mock when NODE_ENV=production', () => {
    expect(() => parseNafath({ NAFATH_MODE: 'mock' }, 'production')).toThrow(
      /NAFATH_MODE=mock cannot run when NODE_ENV=production/,
    );
  });

  it('defaults to inactive Nafath in production (deferred, non-blocking)', () => {
    expect(parseNafath({}, 'production').mode).toBe('inactive');
  });

  it('rejects real mode without official credential placeholders', () => {
    expect(() =>
      parseNafath({ NAFATH_MODE: 'real' }, 'development'),
    ).toThrow(/NAFATH_CLIENT_ID/);
  });

  it('accepts real mode configuration boundary with https base URL', () => {
    const config = parseNafath(
      {
        NAFATH_MODE: 'real',
        NAFATH_CLIENT_ID: 'client-placeholder',
        NAFATH_CLIENT_SECRET: 'secret-placeholder',
        NAFATH_BASE_URL: 'https://nafath.example.invalid',
      },
      'production',
    );

    expect(config.mode).toBe('real');
    expect(config.clientId).toBe('client-placeholder');
    expect(config.baseUrl).toBe('https://nafath.example.invalid');
  });

  it('rejects non-https NAFATH_BASE_URL', () => {
    expect(() =>
      parseNafath(
        {
          NAFATH_MODE: 'real',
          NAFATH_CLIENT_ID: 'client-placeholder',
          NAFATH_CLIENT_SECRET: 'secret-placeholder',
          NAFATH_BASE_URL: 'http://insecure.example',
        },
        'development',
      ),
    ).toThrow(/https/);
  });
});

describe('MockNafathAdapter', () => {
  const adapter = new MockNafathAdapter({
    get: () => ({ mode: 'mock', mockCode: 72 }),
  } as unknown as ConfigService<AppConfig, true>);

  it('accepts the configured development challenge', async () => {
    await expect(adapter.verify({ nationalId: '1999999991', nafathCode: 72 })).resolves.toEqual({
      nationalId: '1999999991',
    });
  });

  it('rejects any other challenge', async () => {
    await expect(
      adapter.verify({ nationalId: '1999999991', nafathCode: 11 }),
    ).resolves.toBeNull();
  });
});

describe('RealNafathAdapter', () => {
  it('fails closed when the official client is not wired', async () => {
    const adapter = new RealNafathAdapter();
    await expect(
      adapter.verify({ nationalId: '1999999991', nafathCode: 72 }),
    ).rejects.toMatchObject({ code: 'AUTH_NAFATH_PROVIDER_UNAVAILABLE' });
  });

  it('never treats a client-supplied code as success without the official client', async () => {
    const adapter = new RealNafathAdapter();
    await expect(
      adapter.verify({ nationalId: '1999999991', nafathCode: 0 }),
    ).rejects.toMatchObject({ code: 'AUTH_NAFATH_PROVIDER_UNAVAILABLE' });
  });

  it('accepts a verified identity from an injected official client', async () => {
    const client: NafathOfficialClient = {
      verifyChallenge: jest.fn().mockResolvedValue({ nationalId: '1999999991' }),
    };
    const adapter = new RealNafathAdapter(client);

    await expect(
      adapter.verify({ nationalId: '1999999991', nafathCode: 42 }),
    ).resolves.toEqual({ nationalId: '1999999991' });
    expect(client.verifyChallenge).toHaveBeenCalledWith({
      nationalId: '1999999991',
      nafathCode: 42,
    });
  });

  it('rejects when the official client returns null', async () => {
    const client: NafathOfficialClient = {
      verifyChallenge: jest.fn().mockResolvedValue(null),
    };
    const adapter = new RealNafathAdapter(client);

    await expect(
      adapter.verify({ nationalId: '1999999991', nafathCode: 11 }),
    ).resolves.toBeNull();
  });

  it('propagates official-client rejection without inventing success', async () => {
    const client: NafathOfficialClient = {
      verifyChallenge: jest.fn().mockRejectedValue(new Error('expired')),
    };
    const adapter = new RealNafathAdapter(client);

    await expect(
      adapter.verify({ nationalId: '1999999991', nafathCode: 72 }),
    ).rejects.toThrow('expired');
  });
});

describe('auth error mapping', () => {
  it('maps controlled auth failures without leaking identifiers', () => {
    expect(authInvalidNationalId().code).toBe('AUTH_INVALID_NATIONAL_ID');
    expect(authNafathFailed().code).toBe('AUTH_NAFATH_VERIFICATION_FAILED');
    expect(authNafathProviderUnavailable().code).toBe(
      'AUTH_NAFATH_PROVIDER_UNAVAILABLE',
    );
    expect(authUnauthorized().code).toBe('AUTH_UNAUTHORIZED');
    expect(authInvalidToken().code).toBe('AUTH_INVALID_TOKEN');
    expect(userNotFound().code).toBe('USER_NOT_FOUND');
    expect(JSON.stringify(authInvalidNationalId())).not.toMatch(/nationalId|1\d{9}/);
  });
});

describe('AuthService', () => {
  const nationalId = '1999999991';
  const userId = 'user_1';

  const nafathAdapter: NafathAdapter = {
    verify: jest.fn(),
  };

  const tx = {
    user: {
      upsert: jest.fn(),
    },
    judicialCard: {
      create: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const jwtService = new JwtService({
    secret: 'unit-test-jwt-access-secret-32chars',
    signOptions: { expiresIn: '15m' },
  });

  const passwordService = {
    hash: jest.fn().mockResolvedValue('hashed'),
    verify: jest.fn().mockResolvedValue(true),
  };

  const service = new AuthService(
    nafathAdapter,
    prisma as unknown as PrismaService,
    jwtService,
    passwordService as unknown as import('../src/modules/auth/password.service').PasswordService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    prisma.auditLog.create.mockResolvedValue({});
    tx.judicialCard.create.mockResolvedValue({ id: 'card_1' });
    tx.judicialCard.upsert.mockResolvedValue({ id: 'card_1' });
    tx.judicialCard.findUnique.mockResolvedValue(null);
  });

  it('creates a user and judicial card on first successful authentication', async () => {
    (nafathAdapter.verify as jest.Mock).mockResolvedValue({ nationalId });
    tx.user.upsert.mockResolvedValue({
      id: userId,
      role: 'CITIZEN',
      deletedAt: null,
      judicialCard: null,
    });

    const result = await service.verifyNafath(nationalId, 72, { ip: '127.0.0.1' });

    expect(tx.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nationalId },
        create: expect.objectContaining({
          nationalId,
          name: 'Citizen',
          role: 'CITIZEN',
        }),
        update: {},
      }),
    );
    expect(tx.judicialCard.upsert).toHaveBeenCalledTimes(1);
    expect(result.accessToken).toEqual(expect.any(String));

    const payload = decode(result.accessToken) as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({ sub: userId, role: 'CITIZEN' }),
    );
    expect(payload).not.toHaveProperty('nationalId');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('email');
    expect(payload.exp).toEqual(expect.any(Number));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS' }),
      }),
    );
  });

  it('maps user from provider-verified nationalId, not a forged client userId', async () => {
    const providerNationalId = '2999999991';
    (nafathAdapter.verify as jest.Mock).mockResolvedValue({
      nationalId: providerNationalId,
    });
    tx.user.upsert.mockResolvedValue({
      id: userId,
      role: 'CITIZEN',
      deletedAt: null,
      judicialCard: { id: 'card_1' },
    });

    await service.verifyNafath(nationalId, 72, {});

    expect(tx.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nationalId: providerNationalId },
      }),
    );
  });

  it('does not create another user or card when the user already exists', async () => {
    (nafathAdapter.verify as jest.Mock).mockResolvedValue({ nationalId });
    tx.user.upsert.mockResolvedValue({
      id: userId,
      role: 'CITIZEN',
      deletedAt: null,
      judicialCard: { id: 'card_1' },
    });

    await service.verifyNafath(nationalId, 72, {});

    expect(tx.user.upsert).toHaveBeenCalledTimes(1);
    expect(tx.judicialCard.create).not.toHaveBeenCalled();
    expect(tx.judicialCard.upsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid National ID before calling Nafath', async () => {
    await expect(service.verifyNafath('0999999991', 72, {})).rejects.toMatchObject({
      code: 'AUTH_INVALID_NATIONAL_ID',
    });
    expect(nafathAdapter.verify).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'AUTH_LOGIN_FAILED',
          metadata: { reason: 'INVALID_NATIONAL_ID' },
        }),
      }),
    );
  });

  it('rejects a failed mock Nafath challenge without issuing a JWT', async () => {
    (nafathAdapter.verify as jest.Mock).mockResolvedValue(null);

    await expect(service.verifyNafath(nationalId, 11, {})).rejects.toMatchObject({
      code: 'AUTH_NAFATH_VERIFICATION_FAILED',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }),
      }),
    );
  });

  it('propagates AUTH_NAFATH_PROVIDER_UNAVAILABLE without issuing a JWT', async () => {
    (nafathAdapter.verify as jest.Mock).mockRejectedValue(
      authNafathProviderUnavailable(),
    );

    await expect(service.verifyNafath(nationalId, 72, {})).rejects.toMatchObject({
      code: 'AUTH_NAFATH_PROVIDER_UNAVAILABLE',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a forged provider identity with an invalid nationalId', async () => {
    (nafathAdapter.verify as jest.Mock).mockResolvedValue({
      nationalId: 'not-a-national-id',
    });

    await expect(service.verifyNafath(nationalId, 72, {})).rejects.toMatchObject({
      code: 'AUTH_NAFATH_VERIFICATION_FAILED',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not issue a JWT when the user/card transaction fails', async () => {
    (nafathAdapter.verify as jest.Mock).mockResolvedValue({ nationalId });
    prisma.$transaction.mockRejectedValue(new Error('db unavailable'));

    await expect(service.verifyNafath(nationalId, 72, {})).rejects.toThrow(
      'db unavailable',
    );
  });

  it('signs a short-lived access token whose expiration is enforced', async () => {
    const token = await service.signAccessToken(userId, 'CITIZEN');
    const verified = jwtService.verify<{ sub: string; role: string; exp: number }>(
      token,
    );
    expect(verified.sub).toBe(userId);
    expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const expired = sign(
      {
        sub: userId,
        role: 'CITIZEN',
        iat: Math.floor(Date.now() / 1000) - 120,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      'unit-test-jwt-access-secret-32chars',
    );
    expect(() =>
      verify(expired, 'unit-test-jwt-access-secret-32chars'),
    ).toThrow(/expired/i);
  });
});
