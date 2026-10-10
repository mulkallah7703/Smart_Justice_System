import { JwtService } from '@nestjs/jwt';
import { decode } from 'jsonwebtoken';

import {
  authInvalidCredentials,
  authWeakPassword,
} from '../src/modules/auth/auth.errors';
import { AuthService } from '../src/modules/auth/auth.service';
import { PasswordService } from '../src/modules/auth/password.service';
import type { NafathAdapter } from '../src/modules/auth/types/auth.types';
import { PrismaService } from '../src/shared/database/prisma.service';
import { Prisma } from '@prisma/client';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password without storing plaintext', async () => {
    const hash = await service.hash('DevCitizen1!');
    expect(hash).not.toContain('DevCitizen1!');
    await expect(service.verify(hash, 'DevCitizen1!')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});

describe('AuthService password register/login', () => {
  const nafathAdapter: NafathAdapter = { verify: jest.fn() };

  const tx = {
    user: { create: jest.fn() },
    judicialCard: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const jwtService = new JwtService({
    secret: 'unit-test-jwt-access-secret-32chars',
    signOptions: { expiresIn: '15m' },
  });

  const passwordService = {
    hash: jest.fn().mockResolvedValue('argon2-hash'),
    verify: jest.fn(),
    verifyDummy: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AuthService(
    nafathAdapter,
    prisma as unknown as PrismaService,
    jwtService,
    passwordService as unknown as PasswordService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    prisma.auditLog.create.mockResolvedValue({});
    tx.judicialCard.upsert.mockResolvedValue({ id: 'card_1' });
    tx.judicialCard.findUnique.mockResolvedValue(null);
  });

  it('registers a CITIZEN user and ignores client role/userId/nationalId', async () => {
    tx.user.create.mockResolvedValue({
      id: 'user_reg',
      name: 'Sara',
      email: 'sara@example.com',
    });

    const result = await service.register({
      name: 'Sara',
      email: 'Sara@Example.com',
      password: 'password12',
    });

    expect(passwordService.hash).toHaveBeenCalledWith('password12');
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Sara',
        email: 'sara@example.com',
        passwordHash: 'argon2-hash',
        role: 'CITIZEN',
      }),
    });
    expect(tx.user.create.mock.calls[0][0].data).not.toHaveProperty('nationalId');
    expect(result).toEqual({
      id: 'user_reg',
      name: 'Sara',
      email: 'sara@example.com',
    });
    expect(nafathAdapter.verify).not.toHaveBeenCalled();
  });

  it('rejects weak passwords', async () => {
    await expect(
      service.register({
        name: 'Sara',
        email: 'sara@example.com',
        password: 'short',
      }),
    ).rejects.toMatchObject({ code: authWeakPassword().code });
  });

  it('suppresses duplicate email with success-shaped response (anti-enumeration)', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.register({
      name: 'Sara',
      email: 'sara@example.com',
      password: 'password12',
    });

    expect(result.email).toBe('sara@example.com');
    expect(result.name).toBe('Sara');
    expect(result.id).toEqual(expect.any(String));
    expect(passwordService.verifyDummy).toHaveBeenCalledWith('password12');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'AUTH_REGISTER_DUPLICATE_SUPPRESSED',
        }),
      }),
    );
  });

  it('logs in with valid credentials and issues a JWT without nationalId', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user_1',
      role: 'CITIZEN',
      passwordHash: 'argon2-hash',
    });
    passwordService.verify.mockResolvedValue(true);

    const result = await service.login({
      email: 'sara@example.com',
      password: 'password12',
    });

    const payload = decode(result.accessToken) as Record<string, unknown>;
    expect(payload.sub).toBe('user_1');
    expect(payload).not.toHaveProperty('nationalId');
    expect(payload).not.toHaveProperty('password');
    expect(nafathAdapter.verify).not.toHaveBeenCalled();
  });

  it('rejects invalid password and missing users with the same error', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user_1',
      role: 'CITIZEN',
      passwordHash: 'argon2-hash',
    });
    passwordService.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: 'sara@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: authInvalidCredentials().code });

    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@example.com', password: 'password12' }),
    ).rejects.toMatchObject({ code: authInvalidCredentials().code });
  });

  it('rejects users without a password hash (Nafath-only legacy)', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user_1',
      role: 'CITIZEN',
      passwordHash: null,
    });

    await expect(
      service.login({ email: 'legacy@example.com', password: 'password12' }),
    ).rejects.toMatchObject({ code: authInvalidCredentials().code });
  });
});
