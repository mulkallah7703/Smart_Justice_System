import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/env.validation';
import { MinioStorageService } from '../modules/documents/storage/minio.storage.service';
import { RedisService } from '../shared/cache/redis.service';
import { PrismaService } from '../shared/database/prisma.service';

import type { DependencyStatus, HealthStatus, ReadinessStatus } from './health.types';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: MinioStorageService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  liveness(): HealthStatus {
    return { status: 'ok' };
  }

  async readiness(): Promise<ReadinessStatus> {
    const nodeEnv = this.configService.get('nodeEnv', { infer: true });
    const ai = this.configService.get('ai', { infer: true });
    const s3 = this.configService.get('s3', { infer: true });

    const [postgresUp, redisUp, storageUp, qdrantUp] = await Promise.all([
      this.prisma.ping(),
      this.redis.ping(),
      this.checkObjectStorage(s3 !== null),
      this.checkQdrant(ai.vectorStoreMode === 'qdrant' ? ai.qdrantUrl : null),
    ]);

    const aiConfigOk = this.checkAiConfig(nodeEnv, ai);

    const checks = {
      postgres: postgresUp ? ('up' as const) : ('down' as const),
      redis: redisUp ? ('up' as const) : ('down' as const),
      objectStorage: this.toStatus(storageUp, s3 !== null || nodeEnv === 'production'),
      qdrant: this.toStatus(qdrantUp, ai.vectorStoreMode === 'qdrant'),
      aiConfig: aiConfigOk ? ('up' as const) : ('down' as const),
    };

    const requiredDown =
      checks.postgres === 'down' ||
      checks.redis === 'down' ||
      checks.objectStorage === 'down' ||
      checks.qdrant === 'down' ||
      checks.aiConfig === 'down';

    return {
      status: requiredDown ? 'error' : 'ok',
      checks,
    };
  }

  private toStatus(
    up: boolean | null,
    required: boolean,
  ): DependencyStatus {
    if (!required) {
      return 'skipped';
    }
    return up ? 'up' : 'down';
  }

  private async checkObjectStorage(configured: boolean): Promise<boolean | null> {
    if (!configured) {
      return null;
    }
    return this.storage.ping();
  }

  private async checkQdrant(url: string | null): Promise<boolean | null> {
    if (!url) {
      return null;
    }
    try {
      const base = url.replace(/\/$/, '');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(`${base}/readyz`, {
          method: 'GET',
          signal: controller.signal,
        });
        return response.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }

  /**
   * Validates AI mode selection without calling OpenAI or exposing secrets.
   * Nafath and Payment are intentionally not readiness dependencies.
   */
  private checkAiConfig(
    nodeEnv: AppConfig['nodeEnv'],
    ai: AppConfig['ai'],
  ): boolean {
    if (nodeEnv !== 'production') {
      return true;
    }
    return (
      ai.providerMode === 'openai' &&
      ai.llmMode === 'openai' &&
      ai.embeddingMode === 'openai' &&
      ai.vectorStoreMode === 'qdrant' &&
      ai.textExtractorMode === 'pdf' &&
      ai.ocrMode === 'local' &&
      Boolean(ai.llmApiKey) &&
      Boolean(ai.embeddingApiKey) &&
      Boolean(ai.qdrantUrl)
    );
  }
}
