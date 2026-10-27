import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/env.validation';
import { documentFormatUnsupported } from '../../ai.errors';
import { assignExtractionTrust } from '../extraction-trust';
import {
  OCR_PROVIDER,
  type OcrProvider,
} from '../ocr-provider.interface';
import {
  cropHeaderPng,
  DIGITS_UNVERIFIED,
  prepareOcrPng,
  reconcileHeaderDigits,
} from '../ocr/ocr-image';
import type {
  DocumentSource,
  ExtractedDocument,
  ExtractedPage,
  ExtractedTextPage,
  TextExtractor,
} from '../text-extractor.interface';

import {
  ARABIC_LAYER_OCR_PREFERRED,
  assessArabicTextLayer,
  scoreExtractedText,
} from './arabic-layer-quality';
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
 * Real text-layer extraction. Pages with no usable text are OCR'd. Arabic
 * text layers that are readable stay as text. Layers that are presentation
 * forms broken apart, duplicated, or watermark-polluted are OCR'd as well,
 * and the higher quality score is kept. Arabic text is not reordered.
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
    const pages: ExtractedPage[] = new Array(layerPages.length);
    let ocrEngine: string | null = null;
    let cursor = 0;
    let settled = 0;
    const concurrency = Math.max(1, Math.min(4, ai.ocrConcurrency || 2));

    const runSlot = async (): Promise<void> => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= layerPages.length) {
          return;
        }
        const layer = layerPages[index]!;
        const textLayer = hasUsableText(layer.text)
          ? this.textLayerPage(source.documentId, layer)
          : null;
        const corrupted =
          textLayer !== null && assessArabicTextLayer(textLayer.text).corrupted;

        if (textLayer && !corrupted) {
          pages[index] = textLayer;
        } else {
          try {
            const recognised = await this.recognisePdfPage(
              source,
              layer.pageNumber,
              ai.ocrDpi,
              ai.ocrMaxPixels,
            );
            ocrEngine = recognised.engine;
            pages[index] = textLayer
              ? this.preferExtraction(textLayer, recognised.page)
              : recognised.page;
          } catch (error) {
            if (!textLayer) {
              throw error;
            }
            pages[index] = textLayer;
          }
        }
        settled += 1;
        await source.onPageSettled?.(settled, layerPages.length);
      }
    };

    const slots = Math.min(concurrency, Math.max(1, layerPages.length));
    await Promise.all(Array.from({ length: slots }, () => runSlot()));

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

  /** Keeps whichever reading scores higher. OCR wins only when it is actually better. */
  private preferExtraction(
    textLayer: ExtractedTextPage,
    ocrPage: ExtractedTextPage,
  ): ExtractedTextPage {
    const layerScore = scoreExtractedText(textLayer);
    const ocrScore = scoreExtractedText(ocrPage);
    if (ocrScore > layerScore && ocrPage.text.trim().length > 0) {
      return {
        ...ocrPage,
        warnings: [...ocrPage.warnings, ARABIC_LAYER_OCR_PREFERRED],
      };
    }
    return textLayer;
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

    const prepared = await prepareOcrPng(rendered.image);
    const recognised = await this.ocr.recognise({
      image: prepared,
      mimeType: rendered.mimeType,
      languageHints: source.languageHints,
      pageNumber,
    });
    let headerText = '';
    if (recognised.text.trim().length > 0) {
      try {
        const header = await this.ocr.recognise({
          image: await cropHeaderPng(prepared),
          mimeType: rendered.mimeType,
          languageHints: source.languageHints,
          pageNumber,
          pass: 'header-digits',
        });
        headerText = header.text;
      } catch {
        headerText = '';
      }
    }

    let merged = reconcileHeaderDigits(recognised.text, headerText);
    if (merged.digitsUnverified) {
      try {
        const confirm = await this.ocr.recognise({
          image: await cropHeaderPng(prepared),
          mimeType: rendered.mimeType,
          languageHints: source.languageHints,
          pageNumber,
          pass: 'header-digits',
        });
        merged = reconcileHeaderDigits(recognised.text, headerText, confirm.text);
      } catch {
        merged = reconcileHeaderDigits(recognised.text, headerText);
      }
    }

    const warnings = [...recognised.warnings];
    if (merged.digitsUnverified) {
      warnings.push(DIGITS_UNVERIFIED);
    }
    const text = merged.text;
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
