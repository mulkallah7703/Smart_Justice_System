export const OCR_PROVIDER = Symbol('OCR_PROVIDER');

/**
 * One already-rendered page handed to a recognition engine.
 *
 * The adapter receives bytes and nothing else: no storage key, no document id,
 * no user id, no job id. Retrieval is the worker's responsibility and page
 * rendering is the extractor's, so an OCR adapter never needs credentials for
 * object storage or the database, and cannot reach either.
 */
export interface OcrPageInput {
  /** Raster image bytes for a single page. Opaque to the caller's domain. */
  image: Buffer;
  /** Media type of `image`, e.g. `image/png`. */
  mimeType: string;
  /** BCP-47 hints. Arabic is first-class, so both are expected in practice. */
  languageHints: readonly string[];
  /**
   * One-based, for correlation in adapter diagnostics only. It is never used to
   * fetch anything, and carries no meaning outside the page currently supplied.
   */
  pageNumber: number;
  /** Digit-focused header pass. The full page uses the default segmentation. */
  pass?: 'page' | 'header-digits';
}

export interface OcrPageResult {
  /** Recognised text for this page. Always untrusted content. */
  text: string;
  /** Engine-reported, when it exposes one. Null when the engine has no notion of it. */
  confidence: number | null;
  /** Detected BCP-47 language, when the engine reports one. */
  language: string | null;
  /** Stable codes only. Never a vendor or library message. */
  warnings: readonly string[];
  /** Engine identity and revision, e.g. `mock-ocr-v1`. */
  engine: string;
}

/**
 * Optical recognition of a single page. Deliberately narrow: it is a pure
 * processing boundary, not a document pipeline. Multi-page handling, page
 * ordering, and the decision of whether a page needs OCR at all belong to
 * `TextExtractor`.
 */
export interface OcrProvider {
  readonly name: string;

  recognise(input: OcrPageInput): Promise<OcrPageResult>;
}
