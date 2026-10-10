import { ConfigService } from '@nestjs/config';

import { MockOcrProvider } from '../../src/modules/ai/providers/mock/mock-ocr.provider';
import { PdfJsPageRenderer } from '../../src/modules/ai/providers/pdf/pdfjs-page-renderer';
import { PdfTextExtractor } from '../../src/modules/ai/providers/pdf/pdf-text-extractor.provider';
import type { PdfPageRenderer } from '../../src/modules/ai/providers/pdf/pdf-page-renderer.interface';
import type { OcrProvider } from '../../src/modules/ai/providers/ocr-provider.interface';

export const createPdfExtractorConfig = (
  overrides: Record<string, unknown> = {},
): ConfigService<never, true> =>
  ({
    get: () => ({
      pdfMaxPages: 100,
      ocrDpi: 150,
      ocrMaxPixels: 16_777_216,
      ocrTimeoutMs: 60_000,
      ocrLangPath: '.ocr-data',
      ocrLanguages: 'ara+eng',
      ...overrides,
    }),
  }) as unknown as ConfigService<never, true>;

export const createPdfTextExtractor = (options?: {
  pdfMaxPages?: number;
  ocr?: OcrProvider;
  renderer?: PdfPageRenderer;
}): PdfTextExtractor =>
  new PdfTextExtractor(
    createPdfExtractorConfig({
      pdfMaxPages: options?.pdfMaxPages ?? 100,
    }),
    options?.renderer ?? new PdfJsPageRenderer(),
    options?.ocr ?? new MockOcrProvider(),
  );
