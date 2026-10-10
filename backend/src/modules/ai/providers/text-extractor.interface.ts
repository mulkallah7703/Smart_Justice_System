import type { ExtractionTrust } from './extraction-trust';

export const TEXT_EXTRACTOR = Symbol('TEXT_EXTRACTOR');

/**
 * How the text on a page was obtained. Only these two exist: either the page
 * carried a usable text layer, or it was recognised optically. Anything else
 * would be a claim the pipeline cannot substantiate.
 */
export const EXTRACTION_METHODS = ['TEXT_LAYER', 'OCR'] as const;

export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

/**
 * The bytes the worker already retrieved, plus the metadata needed to interpret
 * them. No storage key: retrieval has happened by this point.
 */
export interface DocumentSource {
  /** Correlation only, so pages can be attributed. Never used to fetch anything. */
  documentId: string;
  bytes: Buffer;
  mimeType: string;
  languageHints: readonly string[];
}

/** Why a page carries no usable text layer and still needs recognition. */
export type OcrRequiredReason = 'NO_TEXT_LAYER' | 'RASTER_IMAGE';

interface ExtractedPageBase {
  documentId: string;
  /** One-based, matching what a citizen sees in a viewer. Never zero-based. */
  pageNumber: number;
  /** Stable codes only. */
  warnings: readonly string[];
}

export interface ExtractedTextPage extends ExtractedPageBase {
  status: 'EXTRACTED';
  method: ExtractionMethod;
  /**
   * Untrusted content until `trust` says otherwise. Never logged, never
   * persisted to a job result, never put in a prompt instruction.
   */
  text: string;
  /** Meaningful for OCR; null for a text layer, which has no such notion. */
  confidence: number | null;
  language: string | null;
  /**
   * Downstream gate. Only `TRUSTED` pages may enter embeddings / future RAG.
   * Arabic TEXT_LAYER is `REVIEW_REQUIRED` (visual-order Option B). OCR is
   * `REVIEW_REQUIRED` in C.3.5 and is not authoritative legal text.
   */
  trust: ExtractionTrust;
}

/**
 * Reserved for a deferred-recognition shape. Current PdfTextExtractor and
 * MockTextExtractor recognise inline and return `EXTRACTED` pages instead.
 * Kept so a future split between classification and OCR remains representable.
 */
export interface OcrRequiredPage extends ExtractedPageBase {
  status: 'OCR_REQUIRED';
  reason: OcrRequiredReason;
}

export type ExtractedPage = ExtractedTextPage | OcrRequiredPage;

export const isExtractedTextPage = (
  page: ExtractedPage,
): page is ExtractedTextPage => page.status === 'EXTRACTED';

export const isOcrRequiredPage = (
  page: ExtractedPage,
): page is OcrRequiredPage => page.status === 'OCR_REQUIRED';

export interface ExtractedDocument {
  documentId: string;
  /** Ordered by page number and never concatenated, so citations stay possible. */
  pages: readonly ExtractedPage[];
  /** Extractor identity and revision. */
  engine: string;
  /** Identity of the OCR engine, set only when at least one page required OCR. */
  ocrEngine: string | null;
}

/**
 * Turns a retrieved document into per-page text with an explicit trust status.
 *
 * PdfTextExtractor attempts the text layer first, then renders and OCRs pages
 * without usable text. MockTextExtractor simulates both paths. Neither adapter
 * touches object storage, the database, jobs, or users.
 */
export interface TextExtractor {
  readonly name: string;

  extract(source: DocumentSource): Promise<ExtractedDocument>;
}
