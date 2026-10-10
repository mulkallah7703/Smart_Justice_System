/**
 * LIVE INTEGRATION TESTS (thin smoke — NOT full RAG)
 *
 * This suite only checks credentials + Qdrant `/readyz` + a tiny OpenAI
 * embedding. It does NOT run upload → worker → retrieve → answer.
 *
 * Full pipeline verification lives in `rag-pipeline.live.spec.ts`
 * (`RUN_LIVE_RAG_TESTS=true`).
 *
 * Opt-in only:
 *   RUN_LIVE_INTEGRATION_TESTS=1
 * plus LIVE_* credentials (intentionally separate from AI_* / OPENAI_* so this
 * thin suite is never confused with Full RAG).
 *
 * Never fabricate successful provider responses.
 *
 * Required when enabled:
 *   LIVE_DATABASE_URL
 *   LIVE_REDIS_URL
 *   LIVE_S3_ENDPOINT, LIVE_S3_ACCESS_KEY, LIVE_S3_SECRET, LIVE_S3_BUCKET
 *   LIVE_QDRANT_URL
 *   LIVE_OPENAI_API_KEY
 */

const enabled = process.env.RUN_LIVE_INTEGRATION_TESTS === '1';

const describeLive = enabled ? describe : describe.skip;

describeLive('LIVE INTEGRATION TESTS', () => {
  const required = [
    'LIVE_DATABASE_URL',
    'LIVE_REDIS_URL',
    'LIVE_S3_ENDPOINT',
    'LIVE_S3_ACCESS_KEY',
    'LIVE_S3_SECRET',
    'LIVE_S3_BUCKET',
    'LIVE_QDRANT_URL',
    'LIVE_OPENAI_API_KEY',
  ] as const;

  it('requires explicit live credentials (no fabricated success)', () => {
    for (const key of required) {
      expect(process.env[key]?.trim()).toBeTruthy();
    }
  });

  it('pings live Qdrant readyz', async () => {
    const url = process.env.LIVE_QDRANT_URL!.replace(/\/$/, '');
    const response = await fetch(`${url}/readyz`);
    expect(response.ok).toBe(true);
  });

  it('creates a tiny OpenAI embedding (live)', async () => {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.LIVE_OPENAI_API_KEY! });
    const result = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: ['live integration ping'],
      dimensions: 1536,
    });
    expect(result.data[0]?.embedding).toHaveLength(1536);
  });
});
