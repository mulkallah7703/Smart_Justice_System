import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import { RedisService } from '../../../shared/cache/redis.service';
import type { AuthenticatedUser } from '../../auth/types/auth.types';
import { kioskRateLimited } from '../kiosk.errors';

@Injectable()
export class KioskRateLimitGuard implements CanActivate {
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
      throw kioskRateLimited();
    }

    const { maxAttempts, windowSeconds } = this.configService.get(
      'kioskRateLimit',
      { infer: true },
    );

    const key = `kiosk:user:${userId}`;

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(key, windowSeconds);
    } catch {
      throw kioskRateLimited();
    }

    if (count > maxAttempts) {
      throw kioskRateLimited();
    }

    return true;
  }
}
