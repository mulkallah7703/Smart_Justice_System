import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AppConfig } from '../../../config/env.validation';
import { RedisService } from '../../../shared/cache/redis.service';
import { authRateLimited } from '../auth.errors';

/**
 * Per-IP auth throttle. Uses Express `request.ip` only — never reads
 * `X-Forwarded-For` directly. Configure `TRUST_PROXY_HOPS` and keep the API
 * off the public internet so clients cannot spoof the proxy hop.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { maxAttempts, windowSeconds } = this.configService.get(
      'authRateLimit',
      { infer: true },
    );

    const key = `auth:ip:${this.clientIp(request)}`;

    let count: number;
    try {
      count = await this.redis.incrementWithTtl(key, windowSeconds);
    } catch {
      throw authRateLimited();
    }

    if (count > maxAttempts) {
      throw authRateLimited();
    }

    return true;
  }

  private clientIp(request: Request): string {
    const ip = request.ip?.trim();
    if (ip) {
      return ip;
    }
    const remote = request.socket?.remoteAddress?.trim();
    return remote || 'unknown';
  }
}
