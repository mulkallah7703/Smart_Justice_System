import { redisConnectionFromUrl } from '../src/modules/ai/queue/redis-connection';

interface StandaloneRedisOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: object;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
}

describe('redisConnectionFromUrl', () => {
  it('keeps a local redis URL without TLS', () => {
    const options = redisConnectionFromUrl(
      'redis://localhost:6379/0',
    ) as StandaloneRedisOptions;
    expect(options).toMatchObject({
      host: 'localhost',
      port: 6379,
      db: 0,
      maxRetriesPerRequest: null,
    });
    expect(options.tls).toBeUndefined();
    expect(options.enableReadyCheck).toBeUndefined();
  });

  it('trims whitespace before parsing an Upstash URL', () => {
    const options = redisConnectionFromUrl(
      '  rediss://default:secret@example.upstash.io:6379\n',
    ) as StandaloneRedisOptions;
    expect(options).toMatchObject({
      host: 'example.upstash.io',
      port: 6379,
      tls: {},
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  });

  it('configures Upstash TLS for BullMQ', () => {
    const options = redisConnectionFromUrl(
      'rediss://default:secret@example.upstash.io:6379',
    ) as StandaloneRedisOptions;
    expect(options).toMatchObject({
      host: 'example.upstash.io',
      port: 6379,
      username: 'default',
      password: 'secret',
      tls: {},
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  });
});
