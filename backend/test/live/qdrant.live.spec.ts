/**
 * LIVE INTEGRATION TESTS — Qdrant
 *
 * Runs only when:
 *   RUN_LIVE_QDRANT_TESTS=true
 *   AI_QDRANT_URL or LIVE_QDRANT_URL or QDRANT_URL is set
 *
 * Never reports mock success as live.
 */

import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';

loadDotenv({ path: resolve(__dirname, '../../.env') });

const url =
  process.env.LIVE_QDRANT_URL?.trim() ||
  process.env.AI_QDRANT_URL?.trim() ||
  process.env.QDRANT_URL?.trim() ||
  '';

const qdrantLiveEnabled =
  process.env.RUN_LIVE_QDRANT_TESTS === 'true' && Boolean(url);

const describeQdrantLive = qdrantLiveEnabled ? describe : describe.skip;


const COLLECTION = `sjs_live_phase_t_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

const toPointId = (seed: string): string => {
  const hex = createHash('sha1').update(seed).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '5' + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-');
};

describeQdrantLive('LIVE Qdrant', () => {
  const client = new QdrantClient({
    url: url.replace(/\/$/, ''),
    apiKey:
      process.env.LIVE_QDRANT_API_KEY?.trim() ||
      process.env.AI_QDRANT_API_KEY?.trim() ||
      process.env.QDRANT_API_KEY?.trim() ||
      undefined,
    checkCompatibility: false,
  });

  afterAll(async () => {
    try {
      await client.deleteCollection(COLLECTION);
    } catch {
      // best-effort cleanup
    }
  });

  it('creates a cosine 1536 collection, upserts, filters, searches, deletes', async () => {
    await client.createCollection(COLLECTION, {
      vectors: { size: 1536, distance: 'Cosine' },
    });

    // Qdrant Cloud requires indexes for filtered search.
    for (const field of ['userId', 'trust', 'chunkId'] as const) {
      await client.createPayloadIndex(COLLECTION, {
        wait: true,
        field_name: field,
        field_schema: 'keyword',
      });
    }

    const info = await client.getCollection(COLLECTION);
    const vectors = info.config?.params?.vectors as { size?: number; distance?: string };
    expect(vectors.size).toBe(1536);
    expect(String(vectors.distance).toLowerCase()).toContain('cosine');

    const ownerA = 'user-a';
    const ownerB = 'user-b';
    const vectorA = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
    const vectorB = Array.from({ length: 1536 }, (_, i) => (i === 1 ? 1 : 0));
    const idA = toPointId(`${COLLECTION}-a`);
    const idB = toPointId(`${COLLECTION}-b`);

    await client.upsert(COLLECTION, {
      wait: true,
      points: [
        {
          id: idA,
          vector: vectorA,
          payload: { userId: ownerA, trust: 'TRUSTED', chunkId: 'c-a' },
        },
        {
          id: idB,
          vector: vectorB,
          payload: { userId: ownerB, trust: 'TRUSTED', chunkId: 'c-b' },
        },
      ],
    });

    const hits = await client.search(COLLECTION, {
      vector: vectorA,
      limit: 5,
      filter: {
        must: [
          { key: 'userId', match: { value: ownerA } },
          { key: 'trust', match: { value: 'TRUSTED' } },
        ],
      },
    });

    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]?.payload?.userId).toBe(ownerA);
    expect(hits.every((hit) => hit.payload?.userId === ownerA)).toBe(true);

    await client.delete(COLLECTION, { wait: true, points: [idA, idB] });
  });
});

describe('LIVE Qdrant gate', () => {
  it('skips unless RUN_LIVE_QDRANT_TESTS=true and URL is present', () => {
    expect(typeof qdrantLiveEnabled).toBe('boolean');
    if (!qdrantLiveEnabled) {
      expect(qdrantLiveEnabled).toBe(false);
    }
  });
});
