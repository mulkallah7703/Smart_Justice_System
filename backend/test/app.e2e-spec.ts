import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/exceptions/http-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/shared/validation/validation.config';

describe('Backend foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const httpApp = app.getHttpAdapter().getInstance() as {
      set?: (key: string, value: number) => void;
    };
    httpApp.set?.('trust proxy', 1);
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'readyz', method: RequestMethod.GET },
      ],
    });
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots the NestJS application', () => {
    expect(app).toBeDefined();
  });

  it('GET /health returns the success envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: 'ok' });
    expect(response.body.meta.version).toBe('v1');
    expect(response.body.meta.timestamp).toEqual(expect.any(String));
  });

  it('GET /health/ready confirms required dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.checks.postgres).toBe('up');
    expect(response.body.data.checks.redis).toBe('up');
    expect(response.body.data.checks.aiConfig).toBe('up');
    expect(['up', 'skipped']).toContain(response.body.data.checks.objectStorage);
    expect(['up', 'skipped', 'down']).toContain(response.body.data.checks.qdrant);
    expect(response.body.meta.version).toBe('v1');
  });

  it('GET /readyz aliases readiness', async () => {
    const response = await request(app.getHttpServer()).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.checks.postgres).toBe('up');
  });

  it('Prisma can query PostgreSQL after migration', async () => {
    const ping = await prisma.ping();
    expect(ping).toBe(true);

    const userCount = await prisma.user.count();
    expect(userCount).toBeGreaterThanOrEqual(0);

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('User', 'JudicialCard', 'Case', 'AiJob', '_prisma_migrations')
    `;

    const names = tables.map((row) => row.tablename);
    expect(names).toEqual(
      expect.arrayContaining([
        'User',
        'JudicialCard',
        'Case',
        'AiJob',
        '_prisma_migrations',
      ]),
    );
  });

  it('returns the error envelope for unknown API routes', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/does-not-exist',
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.messageAr).toEqual(expect.any(String));
    expect(response.body.meta.version).toBe('v1');
    expect(JSON.stringify(response.body)).not.toMatch(
      /password|nationalId|at Object/i,
    );
  });
});
