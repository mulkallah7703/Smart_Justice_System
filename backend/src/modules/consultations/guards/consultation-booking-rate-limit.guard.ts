import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import { RedisService } from '../../../shared/cache/redis.service';
import type { AuthenticatedUser } from '../../auth/types/auth.types';
import { consultationRateLimited } from '../consultations.errors';

@Injectable()
export class ConsultationBookingRateLimitGuard implements CanActivate {
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
      throw consultationRateLimited();
    }

    const { maxAttempts, windowSeconds } = this.configService.get(
      'consultationBookingRateLimit',
      { infer: true },
    );

    const key = `consultations:book:user:${userId}`;

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(key, windowSeconds);
    } catch {
      throw consultationRateLimited();
    }

    if (count > maxAttempts) {
      throw consultationRateLimited();
    }

    return true;
  }
}
