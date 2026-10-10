/**
 * Phase V security regression tests — authentication & authorization edges.
 * Uses Nest TestingModule without HTTP server where possible.
 */

import { sign } from 'jsonwebtoken';

import { ARGON2_OPTIONS, PasswordService } from '../../src/modules/auth/password.service';
import { AuthRateLimitGuard } from '../../src/modules/auth/guards/auth-rate-limit.guard';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import type { AppConfig } from '../../src/config/env.validation';
import { RedisService } from '../../src/shared/cache/redis.service';
import { validationPipeOptions } from '../../src/shared/validation/validation.config';
import { RegisterDto } from '../../src/modules/auth/dto/register.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Phase V security — passwords', () => {
  const passwords = new PasswordService();

  it('hashes with pinned Argon2id parameters', async () => {
    const hash = await passwords.hash('SecurePass1!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(ARGON2_OPTIONS.memoryCost).toBe(65536);
    expect(ARGON2_OPTIONS.timeCost).toBe(3);
    expect(await passwords.verify(hash, 'SecurePass1!')).toBe(true);
    expect(await passwords.verify(hash, 'wrong')).toBe(false);
  });

  it('verifyDummy completes without throwing', async () => {
    await expect(passwords.verifyDummy('any-password')).resolves.toBeUndefined();
  });
});

describe('Phase V security — auth rate limit IP trust', () => {
  const redis = { incrementWithTtl: jest.fn() };
  const config = {
    get: () => ({ maxAttempts: 10, windowSeconds: 60 }),
  } as unknown as ConfigService<AppConfig, true>;
  const guard = new AuthRateLimitGuard(
    redis as unknown as RedisService,
    config,
  );

  it('keys rate limit by request.ip and ignores spoofed X-Forwarded-For', async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '203.0.113.50',
          headers: { 'x-forwarded-for': '198.51.100.1' },
          socket: { remoteAddress: '10.0.0.2' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(redis.incrementWithTtl).toHaveBeenCalledWith(
      'auth:ip:203.0.113.50',
      60,
    );
  });
});

describe('Phase V security — mass assignment on register DTO', () => {
  it('strips and rejects privileged fields', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Attacker',
      email: 'attacker@example.com',
      password: 'password12',
      role: 'ADMIN',
      isAdmin: true,
      userId: 'another-user',
    });
    const errors = await validate(dto, {
      whitelist: validationPipeOptions.whitelist,
      forbidNonWhitelisted: validationPipeOptions.forbidNonWhitelisted,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toMatch(/role|isAdmin|userId|whitelist/i);
  });
});

describe('Phase V security — JWT algorithm expectations', () => {
  it('rejects unsigned tokens that claim HS256 payload shape', () => {
    const unsigned = sign({ sub: 'user-1', role: 'CITIZEN' }, '', {
      algorithm: 'none',
    });
    expect(unsigned.split('.').length).toBe(3);
    // Application verifies with secret + algorithms:['HS256'] — unsigned must fail.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
      jwt.verify(unsigned, 'local-dev-jwt-access-secret-do-not-reuse', {
        algorithms: ['HS256'],
      });
    }).toThrow();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = sign(
      { sub: 'user-1', role: 'CITIZEN' },
      'wrong-secret-not-the-app-secret-xx',
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
    expect(() =>
      jwt.verify(token, 'local-dev-jwt-access-secret-do-not-reuse', {
        algorithms: ['HS256'],
      }),
    ).toThrow();
  });
});
