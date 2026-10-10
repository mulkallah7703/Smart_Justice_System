import { Injectable } from '@nestjs/common';

import { aiProviderError } from '../../ai.errors';
import type {
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingResult,
} from '../embedding-provider.interface';

import { mockDigest, shouldMockFail } from './mock-directives';

/**
 * DEVELOPMENT/TEST ONLY adapter. Vectors are derived from a hash of the input
 * text. Dimension count comes from configuration so mock mode can align with a
 * local Qdrant collection size in integration tests.
 */
@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';

  constructor(readonly dimensions: number) {}

  get model(): string {
    return 'mock-embedding-v1';
  }

  embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    if (shouldMockFail('embedding', input.texts)) {
      return Promise.reject(aiProviderError());
    }

    return Promise.resolve({
      vectors: input.texts.map((text) => this.vectorFor(text)),
      dimensions: this.dimensions,
      model: this.model,
    });
  }

  private vectorFor(text: string): number[] {
    const digest = mockDigest(text);
    return Array.from({ length: this.dimensions }, (_, index) => {
      const byte = Number.parseInt(
        digest.slice((index * 2) % 60, (index * 2) % 60 + 2) || '00',
        16,
      );
      return Number((byte / 127.5 - 1).toFixed(6));
    });
  }
}
