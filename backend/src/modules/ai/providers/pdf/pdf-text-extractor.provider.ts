import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/env.validation';
import { documentFormatUnsupported } from '../../ai.errors';
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

import { PDF_TEXT_VISUAL_ORDER } from './arabic-text-order';
import { hasUsableText } from './page-text';
import {
  PDF_PAGE_RENDERER,
  type PdfPageRenderer,
} from './pdf-page-renderer.interface';
import { readPdfPages, type PdfPageText } from './pdf-reader';

export { PDF_TEXT_VISUAL_ORDER };

const RASTER_TYPES: readonly string[] = ['image/png', 'image/jpeg'];

/**
 * Real text-layer extraction with local OCR fallback for pages that have no
 * usable text layer. TEXT_LAYER pages are never re-recognised. Arabic
 * TEXT_LAYER output remains order-unresolved (Option B) and is assigned
 * `REVIEW_REQUIRED`. OCR pages are also `REVIEW_REQUIRED` in C.3.5.
 */
@Injectable()
export class PdfTextExtractor implements TextExtractor {
  readonly name = 'pdfjs-text-layer-v1';

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(PDF_PAGE_RENDERER) private readonly renderer: PdfPageRenderer,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
  ) {}

  async extract(source: DocumentSource): Promise<ExtractedDocument> {
    if (RASTER_TYPES.includes(source.mimeType)) {
      return this.recogniseRaster(source);
    }

    if (source.mimeType !== 'application/pdf') {
      throw documentFormatUnsupported();
    }

    const ai = this.configService.get('ai', { infer: true });
    const layerPages = await readPdfPages(source.bytes, ai.pdfMaxPages);
    const pages: ExtractedPage[] = [];
    let ocrEngine: string | null = null;

    // Sequential: OCR is CPU-heavy and unbounded Promise.all would contend
    // for memory with large rendered pages.
    for (const layer of layerPages) {
      if (hasUsableText(layer.text)) {
        pages.push(this.textLayerPage(source.documentId, layer));
        continue;
      }

      const recognised = await this.recognisePdfPage(
        source,
        layer.pageNumber,
        ai.ocrDpi,
        ai.ocrMaxPixels,
      );
      ocrEngine = recognised.engine;
      pages.push(recognised.page);
    }

    return {
      documentId: source.documentId,
      pages,
      engine: this.name,
      ocrEngine,
    };
  }

  private textLayerPage(
    documentId: string,
    page: PdfPageText,
  ): ExtractedTextPage {
    const warnings = page.orderUnresolved ? [PDF_TEXT_VISUAL_ORDER] : [];
    const text = page.text;
    return {
      status: 'EXTRACTED',
      documentId,
      pageNumber: page.pageNumber,
      text,
      method: 'TEXT_LAYER',
      confidence: null,
      language: null,
      warnings,
      trust: assignExtractionTrust({
        method: 'TEXT_LAYER',
        text,
        warnings,
        confidence: null,
      }),
    };
  }

  private async recognisePdfPage(
    source: DocumentSource,
    pageNumber: number,
    dpi: number,
    maxPixels: number,
  ): Promise<{ page: ExtractedTextPage; engine: string }> {
    const rendered = await this.renderer.renderPage({
      bytes: source.bytes,
      pageNumber,
      dpi,
      maxPixels,
    });

    const recognised = await this.ocr.recognise({
      image: rendered.image,
      mimeType: rendered.mimeType,
      languageHints: source.languageHints,
      pageNumber,
    });

    const warnings = [...recognised.warnings];
    const text = recognised.text;
    return {
      engine: recognised.engine,
      page: {
        status: 'EXTRACTED',
        documentId: source.documentId,
        pageNumber,
        text,
        method: 'OCR',
        confidence: recognised.confidence,
        language: recognised.language,
        warnings,
        trust: assignExtractionTrust({
          method: 'OCR',
          text,
          warnings,
          confidence: recognised.confidence,
        }),
      },
    };
  }

  private async recogniseRaster(
    source: DocumentSource,
  ): Promise<ExtractedDocument> {
    const recognised = await this.ocr.recognise({
      image: source.bytes,
      mimeType: source.mimeType,
      languageHints: source.languageHints,
      pageNumber: 1,
    });

    const warnings = [...recognised.warnings];
    const text = recognised.text;
    const page: ExtractedTextPage = {
      status: 'EXTRACTED',
      documentId: source.documentId,
      pageNumber: 1,
      text,
      method: 'OCR',
      confidence: recognised.confidence,
      language: recognised.language,
      warnings,
      trust: assignExtractionTrust({
        method: 'OCR',
        text,
        warnings,
        confidence: recognised.confidence,
      }),
    };

    return {
      documentId: source.documentId,
      pages: [page],
      engine: this.name,
      ocrEngine: recognised.engine,
    };
  }
}
