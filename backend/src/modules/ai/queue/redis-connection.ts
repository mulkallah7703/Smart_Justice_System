import type { ConnectionOptions } from 'bullmq';

/**
 * Builds connection options that BullMQ owns and closes itself.
 *
 * BullMQ is given its own connection rather than reusing `RedisService`:
 * blocking commands require `maxRetriesPerRequest: null`, which is the opposite
 * of what the rate-limit client wants, so sharing one client would degrade
 * either the queue or the existing rate limiting.
 */
export const redisConnectionFromUrl = (raw: string): ConnectionOptions => {
  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, '');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: database ? Number(database) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
};
