import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppConfig } from '../../config/env.validation';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get('redisUrl', { infer: true });
    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });

    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.quit();
    this.client = null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const client = this.requireClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }
    return count;
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }
}
