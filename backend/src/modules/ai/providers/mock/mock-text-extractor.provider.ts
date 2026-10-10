import { Inject, Injectable } from '@nestjs/common';

import { assignExtractionTrust } from '../extraction-trust';
import {
  OCR_PROVIDER,
  type OcrProvider,
} from '../ocr-provider.interface';
import type {
  DocumentSource,
  ExtractedDocument,
  ExtractedPage,
  ExtractedTextPage,
  TextExtractor,
} from '../text-extractor.interface';

import { mockDigest } from './mock-directives';

/**
 * Synthetic stand-in for a rendered page. It is deliberately readable text
 * rather than image bytes, and it embeds the document id so a test marker can
 * reach the mock OCR adapter exactly as it would through a real render. No
 * rendering library is involved.
 */
const mockPageImage = (documentId: string, pageNumber: number): Buffer =>
  Buffer.from(`MOCK_PAGE_IMAGE:${documentId}:${pageNumber}`, 'utf8');

const withTrust = (
  page: Omit<ExtractedTextPage, 'trust'>,
): ExtractedTextPage => ({
  ...page,
  trust: assignExtractionTrust({
    method: page.method,
    text: page.text,
    warnings: page.warnings,
    confidence: page.confidence,
  }),
});

/**
 * DEVELOPMENT/TEST ONLY extractor. It parses nothing: no PDF is read, no page
 * is rendered, and no text layer is inspected. It produces a deterministic page
 * set so the rest of the pipeline can be exercised without a PDF library or a
 * recognition engine, and it exercises both routes:
 *
 * - a PDF yields two pages, the first served from a "text layer" and the second
 *   routed to OCR, which is the mixed-document shape the real extractor must
 *   handle;
 * - an image yields a single OCR page, since a raster image can never carry a
 *   text layer.
 *
 * Trust follows the same C.3.5 policy as the real extractor. Every page is
 * marked so no caller can mistake this for real extraction.
 */
@Injectable()
export class MockTextExtractor implements TextExtractor {
  readonly name = 'mock-text-extractor-v1';

  constructor(@Inject(OCR_PROVIDER) private readonly ocr: OcrProvider) {}

  async extract(source: DocumentSource): Promise<ExtractedDocument> {
    const pages: ExtractedPage[] = [];
    let ocrEngine: string | null = null;

    // One-based throughout. The count is fixed per media type so results stay
    // reproducible across runs and processes.
    const pageCount = source.mimeType === 'application/pdf' ? 2 : 1;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (this.hasMockTextLayer(source.mimeType, pageNumber)) {
        pages.push(
          withTrust({
            status: 'EXTRACTED',
            documentId: source.documentId,
            pageNumber,
            text: `MOCK_TEXT_LAYER:${mockDigest(source.documentId, String(pageNumber)).slice(0, 32)}`,
            method: 'TEXT_LAYER',
            // A text layer is read, not recognised, so confidence has no meaning.
            confidence: null,
            language: source.languageHints[0] ?? null,
            warnings: ['MOCK_EXTRACTION_NO_PARSING_PERFORMED'],
          }),
        );
        continue;
      }

      const recognised = await this.ocr.recognise({
        image: mockPageImage(source.documentId, pageNumber),
        mimeType: 'image/png',
        languageHints: source.languageHints,
        pageNumber,
      });
      ocrEngine = recognised.engine;

      pages.push(
        withTrust({
          status: 'EXTRACTED',
          documentId: source.documentId,
          pageNumber,
          text: recognised.text,
          method: 'OCR',
          confidence: recognised.confidence,
          language: recognised.language,
          warnings: recognised.warnings,
        }),
      );
    }

    return {
      documentId: source.documentId,
      pages,
      engine: this.name,
      ocrEngine,
    };
  }

  /** Deterministic stand-in for the real per-page classification. */
  private hasMockTextLayer(mimeType: string, pageNumber: number): boolean {
    return mimeType === 'application/pdf' && pageNumber === 1;
  }
}
