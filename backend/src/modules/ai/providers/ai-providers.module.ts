import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import type { OcrProvider } from './ocr-provider.interface';

import { EMBEDDING_PROVIDER } from './embedding-provider.interface';
import {
  ANSWER_LLM_PROVIDER,
  LLM_PROVIDER,
} from './llm-provider.interface';
import { MockEmbeddingProvider } from './mock/mock-embedding.provider';
import { MockLlmProvider } from './mock/mock-llm.provider';
import { MockOcrProvider } from './mock/mock-ocr.provider';
import { MockTextExtractor } from './mock/mock-text-extractor.provider';
import { LocalOcrProvider } from './ocr/local-ocr.provider';
import { OCR_PROVIDER } from './ocr-provider.interface';
import { OpenAiEmbeddingProvider } from './openai/openai-embedding.provider';
import { OpenAiLlmProvider } from './openai/openai-llm.provider';
import { PDF_PAGE_RENDERER } from './pdf/pdf-page-renderer.interface';
import { PdfJsPageRenderer } from './pdf/pdfjs-page-renderer';
import { PdfTextExtractor } from './pdf/pdf-text-extractor.provider';
import { TEXT_EXTRACTOR, type TextExtractor } from './text-extractor.interface';
import { MockVectorStore } from '../vector/mock-vector.store';
import { QdrantVectorStore } from '../vector/qdrant-vector.store';
import { VECTOR_STORE, type VectorStore } from '../vector/vector-store.interface';
import type { EmbeddingProvider } from './embedding-provider.interface';
import type { LlmProvider } from './llm-provider.interface';

const selectWorkerLlm = (
  configService: ConfigService<AppConfig, true>,
  mock: MockLlmProvider,
  openai: OpenAiLlmProvider,
): LlmProvider => {
  const { providerMode } = configService.get('ai', { infer: true });
  switch (providerMode) {
    case 'openai':
      return openai;
    case 'mock':
      return mock;
    default: {
      const unreachable: never = providerMode;
      throw new Error(`No worker LLM for mode: ${String(unreachable)}`);
    }
  }
};

const selectTextExtractor = (
  configService: ConfigService<AppConfig, true>,
  mock: MockTextExtractor,
  pdf: PdfTextExtractor,
): TextExtractor => {
  const { textExtractorMode } = configService.get('ai', { infer: true });

  switch (textExtractorMode) {
    case 'pdf':
      return pdf;
    case 'mock':
      return mock;
    default: {
      const unreachable: never = textExtractorMode;
      throw new Error(`No text extractor registered for mode: ${String(unreachable)}`);
    }
  }
};

const selectOcr = (
  configService: ConfigService<AppConfig, true>,
  mock: MockOcrProvider,
  local: LocalOcrProvider,
): OcrProvider => {
  const { ocrMode } = configService.get('ai', { infer: true });

  switch (ocrMode) {
    case 'local':
      return local;
    case 'mock':
      return mock;
    default: {
      const unreachable: never = ocrMode;
      throw new Error(`No OCR adapter registered for mode: ${String(unreachable)}`);
    }
  }
};

const selectEmbedding = (
  configService: ConfigService<AppConfig, true>,
  mock: MockEmbeddingProvider,
  openai: OpenAiEmbeddingProvider,
): EmbeddingProvider => {
  const { embeddingMode } = configService.get('ai', { infer: true });
  switch (embeddingMode) {
    case 'openai':
      return openai;
    case 'mock':
      return mock;
    default: {
      const unreachable: never = embeddingMode;
      throw new Error(`No embedding adapter for mode: ${String(unreachable)}`);
    }
  }
};

const selectVectorStore = (
  configService: ConfigService<AppConfig, true>,
  mock: MockVectorStore,
  qdrant: QdrantVectorStore,
): VectorStore => {
  const { vectorStoreMode } = configService.get('ai', { infer: true });
  switch (vectorStoreMode) {
    case 'qdrant':
      return qdrant;
    case 'mock':
      return mock;
    default: {
      const unreachable: never = vectorStoreMode;
      throw new Error(`No vector store for mode: ${String(unreachable)}`);
    }
  }
};

const selectAnswerLlm = (
  configService: ConfigService<AppConfig, true>,
  mock: MockLlmProvider,
  openai: OpenAiLlmProvider,
): LlmProvider => {
  const { llmMode } = configService.get('ai', { infer: true });
  switch (llmMode) {
    case 'openai':
      return openai;
    case 'mock':
      return mock;
    default: {
      const unreachable: never = llmMode;
      throw new Error(`No answer LLM for mode: ${String(unreachable)}`);
    }
  }
};

@Module({
  providers: [
    MockLlmProvider,
    OpenAiLlmProvider,
    MockOcrProvider,
    MockTextExtractor,
    LocalOcrProvider,
    PdfJsPageRenderer,
    PdfTextExtractor,
    OpenAiEmbeddingProvider,
    QdrantVectorStore,
    {
      provide: MockEmbeddingProvider,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        new MockEmbeddingProvider(
          configService.get('ai', { infer: true }).embeddingDimensions,
        ),
    },
    {
      provide: MockVectorStore,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        new MockVectorStore(
          configService.get('ai', { infer: true }).embeddingDimensions,
        ),
    },
    {
      provide: PDF_PAGE_RENDERER,
      useExisting: PdfJsPageRenderer,
    },
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, MockLlmProvider, OpenAiLlmProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mock: MockLlmProvider,
        openai: OpenAiLlmProvider,
      ): LlmProvider => selectWorkerLlm(configService, mock, openai),
    },
    {
      provide: ANSWER_LLM_PROVIDER,
      inject: [ConfigService, MockLlmProvider, OpenAiLlmProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mock: MockLlmProvider,
        openai: OpenAiLlmProvider,
      ): LlmProvider => selectAnswerLlm(configService, mock, openai),
    },
    {
      provide: EMBEDDING_PROVIDER,
      inject: [ConfigService, MockEmbeddingProvider, OpenAiEmbeddingProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mock: MockEmbeddingProvider,
        openai: OpenAiEmbeddingProvider,
      ): EmbeddingProvider => selectEmbedding(configService, mock, openai),
    },
    {
      provide: VECTOR_STORE,
      inject: [ConfigService, MockVectorStore, QdrantVectorStore],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mock: MockVectorStore,
        qdrant: QdrantVectorStore,
      ): VectorStore => selectVectorStore(configService, mock, qdrant),
    },
    {
      provide: OCR_PROVIDER,
      inject: [ConfigService, MockOcrProvider, LocalOcrProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mock: MockOcrProvider,
        local: LocalOcrProvider,
      ): OcrProvider => selectOcr(configService, mock, local),
    },
    {
      provide: TEXT_EXTRACTOR,
      inject: [ConfigService, MockTextExtractor, PdfTextExtractor],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mock: MockTextExtractor,
        pdf: PdfTextExtractor,
      ): TextExtractor => selectTextExtractor(configService, mock, pdf),
    },
  ],
  exports: [
    LLM_PROVIDER,
    ANSWER_LLM_PROVIDER,
    EMBEDDING_PROVIDER,
    VECTOR_STORE,
    OCR_PROVIDER,
    TEXT_EXTRACTOR,
  ],
})
export class AiProvidersModule {}
