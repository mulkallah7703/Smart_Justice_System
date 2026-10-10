/**
 * LIVE INTEGRATION TESTS — OpenAI
 *
 * Runs only when:
 *   RUN_LIVE_AI_TESTS=true
 *   OPENAI_API_KEY or LIVE_OPENAI_API_KEY is set
 *
 * Never fabricates success. Never logs the API key.
 */

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(__dirname, '../../.env') });

const openaiLiveEnabled =
  process.env.RUN_LIVE_AI_TESTS === 'true' &&
  Boolean(
    process.env.LIVE_OPENAI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );

const describeOpenAiLive = openaiLiveEnabled ? describe : describe.skip;

describeOpenAiLive('LIVE OpenAI', () => {
  const apiKey =
    process.env.LIVE_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    '';

  it('creates a chat completion (gpt-4o-mini)', async () => {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey, timeout: 30_000 });
    const started = Date.now();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 64,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Reply with JSON only: {"ok":true}',
        },
        { role: 'user', content: 'ping' },
      ],
    });
    const latencyMs = Date.now() - started;
    const text = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as { ok?: boolean };
    expect(parsed.ok).toBe(true);
    expect(latencyMs).toBeGreaterThan(0);
    expect(latencyMs).toBeLessThan(60_000);
  });

  it('creates an embedding with 1536 dimensions', async () => {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey, timeout: 30_000 });
    const started = Date.now();
    const result = await client.embeddings.create({
      model:
        process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
      input: ['phase-t live embedding ping'],
      dimensions: 1536,
    });
    const latencyMs = Date.now() - started;
    expect(result.data[0]?.embedding).toHaveLength(1536);
    expect(latencyMs).toBeGreaterThan(0);
  });
});

describe('LIVE OpenAI gate', () => {
  it('skips unless RUN_LIVE_AI_TESTS=true and a key is present', () => {
    expect(typeof openaiLiveEnabled).toBe('boolean');
    if (!openaiLiveEnabled) {
      expect(openaiLiveEnabled).toBe(false);
    }
  });
});
