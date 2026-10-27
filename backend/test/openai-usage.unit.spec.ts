import { Logger } from '@nestjs/common';

import { OpenAiLlmProvider } from '../src/modules/ai/providers/openai/openai-llm.provider';

describe('OpenAiLlmProvider usage', () => {
  it('returns and logs prompt and completion tokens without the prompt text', async () => {
    const provider = new OpenAiLlmProvider({
      get: () => ({
        llmModel: 'gpt-test',
        llmMaxOutputTokens: 32,
        llmTemperature: 0,
        llmTimeoutMs: 1000,
        llmApiKey: 'test-key',
      }),
    } as never);
    const secret = 'SECRET_PROMPT_DO_NOT_LOG';
    const create = jest.fn().mockResolvedValue({
      model: 'gpt-test',
      choices: [{ message: { content: 'ملخص عربي' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    (provider as unknown as { client: unknown }).client = {
      chat: { completions: { create } },
    };
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const result = await provider.complete({
      instruction: secret,
      untrustedContext: ['evidence'],
    });

    expect(result.promptTokens).toBe(11);
    expect(result.completionTokens).toBe(7);
    expect(result.text).toBe('ملخص عربي');
    const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('promptTokens=11');
    expect(logged).toContain('completionTokens=7');
    expect(logged).not.toContain(secret);
    logSpy.mockRestore();
  });
});
