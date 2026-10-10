import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import type { AppConfig } from '../../../../config/env.validation';
import { AppError } from '../../../../shared/exceptions/app-error';
import {
  aiEmbeddingAuthFailed,
  aiEmbeddingDimensionMismatch,
  aiEmbeddingError,
  aiEmbeddingRateLimited,
} from '../../ai.errors';
import type {
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingResult,
} from '../embedding-provider.interface';

/**
 * OpenAI embeddings. Sends only chunk text — never userId, storage keys, or secrets.
 * Model: text-embedding-3-small (1536 dims, cosine). No silent truncation.
 */
@Injectable()
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimensions: number;
  readonly model: string;

  private readonly logger = new Logger(OpenAiEmbeddingProvider.name);
  private readonly client: OpenAI | null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const ai = this.configService.get('ai', { infer: true });
    this.dimensions = ai.embeddingDimensions;
    this.model = ai.embeddingModel;
    this.client = ai.embeddingApiKey
      ? new OpenAI({ apiKey: ai.embeddingApiKey })
      : null;
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    if (!this.client) {
      throw aiEmbeddingAuthFailed();
    }
    if (input.texts.length === 0) {
      return { vectors: [], dimensions: this.dimensions, model: this.model };
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: [...input.texts],
        dimensions: this.dimensions,
      });

      const ordered = [...response.data].sort((a, b) => a.index - b.index);
      if (ordered.length !== input.texts.length) {
        throw aiEmbeddingError();
      }

      const vectors = ordered.map((row) => {
        if (row.embedding.length !== this.dimensions) {
          throw aiEmbeddingDimensionMismatch();
        }
        return row.embedding;
      });

      return {
        vectors,
        dimensions: this.dimensions,
        model: this.model,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof AppError) {
      return error;
    }

    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
        ? (error as { status: number }).status
        : undefined;

    this.logger.warn(`OpenAI embedding failed status=${status ?? 'unknown'}`);

    if (status === 401 || status === 403) {
      return aiEmbeddingAuthFailed();
    }
    if (status === 429) {
      return aiEmbeddingRateLimited();
    }
    return aiEmbeddingError();
  }
}
