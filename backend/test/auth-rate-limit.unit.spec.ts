import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../src/config/env.validation';
import { AuthRateLimitGuard } from '../src/modules/auth/guards/auth-rate-limit.guard';
import { RedisService } from '../src/shared/cache/redis.service';

describe('AuthRateLimitGuard', () => {
  const redis = {
    incrementWithTtl: jest.fn(),
  };

  const config = {
    get: () => ({ maxAttempts: 10, windowSeconds: 60 }),
  } as unknown as ConfigService<AppConfig, true>;

  const guard = new AuthRateLimitGuard(
    redis as unknown as RedisService,
    config,
  );

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ ip: '127.0.0.1', headers: {} }),
    }),
  } as unknown as ExecutionContext;

  it('allows requests under the limit', async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks requests over the limit', async () => {
    redis.incrementWithTtl.mockResolvedValue(11);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
    });
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.incrementWithTtl.mockRejectedValue(new Error('redis down'));
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
    });
  });

  it('does not use X-Forwarded-For when request.ip is set', async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    const spoofed = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '192.0.2.10',
          headers: { 'x-forwarded-for': '203.0.113.99' },
          socket: { remoteAddress: '10.0.0.1' },
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(spoofed)).resolves.toBe(true);
    expect(redis.incrementWithTtl).toHaveBeenCalledWith(
      'auth:ip:192.0.2.10',
      60,
    );
  });
});
