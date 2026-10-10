import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import { RedisService } from '../../../shared/cache/redis.service';
import type { AuthenticatedUser } from '../../auth/types/auth.types';
import { paymentRateLimited } from '../payments.errors';

/**
 * Guards citizen-initiated payment creation only. Provider webhooks are not
 * authenticated as citizens and are protected by signature verification, so
 * they are never routed through this limiter.
 */
@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
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
      throw paymentRateLimited();
    }

    const { maxAttempts, windowSeconds } = this.configService.get(
      'paymentRateLimit',
      { infer: true },
    );

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(
        `payments:initiate:user:${userId}`,
        windowSeconds,
      );
    } catch {
      throw paymentRateLimited();
    }

    if (count > maxAttempts) {
      throw paymentRateLimited();
    }

    return true;
  }
}
