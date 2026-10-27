import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.validation';
import { AppError } from '../../../../shared/exceptions/app-error';
import {
  aiLlmAuthFailed,
  aiLlmError,
  aiLlmRateLimited,
  aiLlmTimeout,
} from '../../ai.errors';
import type {
  LlmCompletion,
  LlmCompletionInput,
  LlmGenerateAnswerInput,
  LlmGenerateAnswerResult,
  LlmProvider,
} from '../llm-provider.interface';

/**
 * OpenAI chat completions for legal RAG answers.
 * Never logs prompts, evidence, or API keys.
 */
@Injectable()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  readonly model: string;

  private readonly logger = new Logger(OpenAiLlmProvider.name);
  private readonly client: OpenAI | null;
  private readonly maxOutputTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const ai = this.configService.get('ai', { infer: true });
    this.model = ai.llmModel;
    this.maxOutputTokens = ai.llmMaxOutputTokens;
    this.temperature = ai.llmTemperature;
    this.timeoutMs = ai.llmTimeoutMs;
    this.client = ai.llmApiKey
      ? new OpenAI({
          apiKey: ai.llmApiKey,
          timeout: ai.llmTimeoutMs,
        })
      : null;
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletion> {
    // Worker path: keep a bounded chat call when openai mode is selected.
    const result = await this.chat({
      system: input.instruction,
      user: input.untrustedContext.join('\n'),
    });
    return {
      text: result.text,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    };
  }

  async generateAnswer(
    input: LlmGenerateAnswerInput,
  ): Promise<LlmGenerateAnswerResult> {
    return this.chat({
      system: input.systemPrompt,
      user: input.userPrompt,
      jsonObject: true,
    });
  }

  private async chat(input: {
    system: string;
    user: string;
    jsonObject?: boolean;
  }): Promise<LlmGenerateAnswerResult> {
    if (!this.client) {
      throw aiLlmAuthFailed();
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.client.chat.completions.create(
          {
            model: this.model,
            temperature: this.temperature,
            max_tokens: this.maxOutputTokens,
            response_format: input.jsonObject
              ? { type: 'json_object' }
              : undefined,
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: input.user },
            ],
          },
          { signal: controller.signal },
        );

        const text = response.choices[0]?.message?.content?.trim() ?? '';
        if (!text) {
          throw aiLlmError();
        }

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        this.logger.log(
          `OpenAI usage model=${response.model || this.model} promptTokens=${promptTokens} completionTokens=${completionTokens}`,
        );
        return {
          text,
          model: response.model || this.model,
          promptTokens,
          completionTokens,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof AppError) {
      return error;
    }

    const name =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof (error as { name: unknown }).name === 'string'
        ? (error as { name: string }).name
        : '';

    if (name === 'AbortError' || name === 'APIUserAbortError') {
      this.logger.warn('OpenAI LLM timed out');
      return aiLlmTimeout();
    }

    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
        ? (error as { status: number }).status
        : undefined;

    this.logger.warn(`OpenAI LLM failed status=${status ?? 'unknown'}`);

    if (status === 401 || status === 403) {
      return aiLlmAuthFailed();
    }
    if (status === 429) {
      return aiLlmRateLimited();
    }
    if (status === 408 || status === 504) {
      return aiLlmTimeout();
    }
    return aiLlmError();
  }
}
