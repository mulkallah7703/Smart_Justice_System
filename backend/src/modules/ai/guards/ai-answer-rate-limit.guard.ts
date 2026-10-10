import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import { RedisService } from '../../../shared/cache/redis.service';
import type { AuthenticatedUser } from '../../auth/types/auth.types';
import { aiRateLimited } from '../ai.errors';

/**
 * Per-user limit on RAG answer generation. Fails closed if Redis or identity
 * is unavailable. Dedicated counter — not shared with retrieve/analyze.
 */
@Injectable()
export class AiAnswerRateLimitGuard implements CanActivate {
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
      throw aiRateLimited();
    }

    const { maxAttempts, windowSeconds } = this.configService.get(
      'aiAnswerRateLimit',
      { infer: true },
    );

    const key = `ai:advisor:answer:user:${userId}`;

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(key, windowSeconds);
    } catch {
      throw aiRateLimited();
    }

    if (count > maxAttempts) {
      throw aiRateLimited();
    }

    return true;
  }
}
