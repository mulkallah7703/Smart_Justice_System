import { Injectable } from '@nestjs/common';

import { aiProviderError } from '../../ai.errors';
import type {
  OcrPageInput,
  OcrPageResult,
  OcrProvider,
} from '../ocr-provider.interface';

import { mockDigest, shouldMockFail } from './mock-directives';

/**
 * DEVELOPMENT/TEST ONLY adapter. It runs no recognition engine and does not
 * interpret the supplied bytes as an image; it returns a marked placeholder
 * derived from them. Real recognition is a later step. Configuration refuses to
 * select it when NODE_ENV=production.
 */
@Injectable()
export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';

  recognise(input: OcrPageInput): Promise<OcrPageResult> {
    // Mock page images are synthetic and carry a readable label, which is how a
    // test drives a reproducible failure through the real worker path. Real
    // image bytes would simply never contain a marker.
    const label = input.image.toString('utf8');
    if (shouldMockFail('ocr', [label])) {
      return Promise.reject(aiProviderError());
    }

    const digest = mockDigest(label, input.mimeType, String(input.pageNumber));

    return Promise.resolve({
      text: `MOCK_OCR_TEXT:${digest.slice(0, 32)}`,
      // A fixed value, not a measurement: nothing was recognised.
      confidence: null,
      language: input.languageHints[0] ?? null,
      warnings: ['MOCK_OCR_NO_RECOGNITION_PERFORMED'],
      engine: 'mock-ocr-v1',
    });
  }
}
