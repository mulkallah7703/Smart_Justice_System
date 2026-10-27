import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../src/config/env.validation';
import { HealthService } from '../src/health/health.service';
import type { MinioStorageService } from '../src/modules/documents/storage/minio.storage.service';
import type { RedisService } from '../src/shared/cache/redis.service';
import type { PrismaService } from '../src/shared/database/prisma.service';

describe('HealthService Qdrant readiness', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls /readyz on port 443 with the api-key header', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const config = {
      get: (key: string) => {
        if (key === 'nodeEnv') {
          return 'production';
        }
        if (key === 's3') {
          return { endpoint: 'https://account.r2.cloudflarestorage.com' };
        }
        return {
          vectorStoreMode: 'qdrant',
          qdrantUrl: 'https://cluster.eu-central.aws.cloud.qdrant.io:443',
          qdrantApiKey: 'cloud-key',
          providerMode: 'openai',
          llmMode: 'openai',
          embeddingMode: 'openai',
          textExtractorMode: 'pdf',
          ocrMode: 'local',
          llmApiKey: 'sk-test',
          embeddingApiKey: 'sk-test',
        };
      },
    } as unknown as ConfigService<AppConfig, true>;

    const service = new HealthService(
      { ping: async () => true } as unknown as PrismaService,
      { ping: async () => true } as unknown as RedisService,
      { ping: async () => true } as unknown as MinioStorageService,
      config,
    );

    const status = await service.readiness();

    expect(status.checks.qdrant).toBe('up');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://cluster.eu-central.aws.cloud.qdrant.io:443/readyz',
      expect.objectContaining({
        method: 'GET',
        headers: { 'api-key': 'cloud-key' },
      }),
    );
  });
});
