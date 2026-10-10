import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AiAnalysisRateLimitGuard } from '../src/modules/ai/guards/ai-analysis-rate-limit.guard';
import type { RedisService } from '../src/shared/cache/redis.service';

const context = (userId?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => (userId ? { user: { sub: userId } } : {}),
    }),
  }) as ExecutionContext;

const configStub = {
  get: () => ({ maxAttempts: 3, windowSeconds: 900 }),
} as unknown as ConfigService<never, true>;

const redisStub = (impl: () => Promise<number>): RedisService =>
  ({ incrementWithTtl: impl }) as unknown as RedisService;

describe('AI analysis rate limit guard', () => {
  it('allows requests up to the configured maximum', async () => {
    let count = 0;
    const guard = new AiAnalysisRateLimitGuard(
      redisStub(() => Promise.resolve(++count)),
      configStub as never,
    );

    await expect(guard.canActivate(context('user-1'))).resolves.toBe(true);
    await expect(guard.canActivate(context('user-1'))).resolves.toBe(true);
    await expect(guard.canActivate(context('user-1'))).resolves.toBe(true);
  });

  it('rejects once the maximum is exceeded', async () => {
    const guard = new AiAnalysisRateLimitGuard(
      redisStub(() => Promise.resolve(4)),
      configStub as never,
    );

    await expect(guard.canActivate(context('user-1'))).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
    });
  });

  it('fails closed when Redis is unavailable', async () => {
    const guard = new AiAnalysisRateLimitGuard(
      redisStub(() => Promise.reject(new Error('ECONNREFUSED 127.0.0.1:6379'))),
      configStub as never,
    );

    await expect(guard.canActivate(context('user-1'))).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
    });
  });

  it('never leaks the underlying Redis error to the client', async () => {
    const guard = new AiAnalysisRateLimitGuard(
      redisStub(() => Promise.reject(new Error('ECONNREFUSED 127.0.0.1:6379'))),
      configStub as never,
    );

    await guard.canActivate(context('user-1')).catch((error: Error) => {
      expect(error.message).not.toContain('ECONNREFUSED');
      expect(error.message).not.toContain('6379');
    });
  });

  it('fails closed when the request carries no authenticated identity', async () => {
    const guard = new AiAnalysisRateLimitGuard(
      redisStub(() => Promise.resolve(1)),
      configStub as never,
    );

    await expect(guard.canActivate(context())).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
    });
  });
});
