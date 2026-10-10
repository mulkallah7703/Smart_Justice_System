import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { RedisService } from '../../../shared/cache/redis.service';
import type { AuthenticatedUser } from '../../auth/types/auth.types';
import { caseRateLimited } from '../cases.errors';

const MAX_ATTEMPTS = 20;
const WINDOW_SECONDS = 60;

@Injectable()
export class CaseCreateRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw caseRateLimited();
    }

    const key = `cases:create:user:${userId}`;

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(key, WINDOW_SECONDS);
    } catch {
      throw caseRateLimited();
    }

    if (count > MAX_ATTEMPTS) {
      throw caseRateLimited();
    }

    return true;
  }
}
