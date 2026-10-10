import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/env.validation';
import { RedisService } from '../../../../shared/cache/redis.service';
import type { AuthenticatedUser } from '../../../auth/types/auth.types';
import { aiGuideRateLimited } from '../errors/guide.errors';

/**
 * Per-user Guide limit. Fails closed if Redis or identity is unavailable.
 * Dedicated counter — not shared with Advisor analyze/retrieve/answer.
 */
@Injectable()
export class GuideRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw aiGuideRateLimited();
    }

    const { maxAttempts, windowSeconds } = this.configService.get(
      'aiGuideRateLimit',
      { infer: true },
    );

    const key = `ai:guide:user:${userId}`;

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(key, windowSeconds);
    } catch {
      throw aiGuideRateLimited();
    }

    if (count > maxAttempts) {
      throw aiGuideRateLimited();
    }

    return true;
  }
}
