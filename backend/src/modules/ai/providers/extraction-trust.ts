import { PDF_TEXT_VISUAL_ORDER, pageContainsArabicScript } from './pdf/arabic-text-order';

/**
 * Per-page suitability for automatic downstream use (embeddings / future RAG).
 *
 * C.3.5 policy: only `TRUSTED` pages may enter embed/LLM input. OCR is never
 * promoted to `TRUSTED` in this phase. Arabic TEXT_LAYER is order-unresolved
 * (Option B) and therefore `REVIEW_REQUIRED`.
 */
export const EXTRACTION_TRUSTS = [
  'TRUSTED',
  'REVIEW_REQUIRED',
  'UNUSABLE',
] as const;

export type ExtractionTrust = (typeof EXTRACTION_TRUSTS)[number];

export interface ExtractionTrustInput {
  /** Same values as ExtractionMethod; inlined to avoid a circular import. */
  method: 'TEXT_LAYER' | 'OCR';
  /** Original extracted text. Must not be rewritten before trust assignment. */
  text: string;
  warnings: readonly string[];
  /** OCR page confidence when the engine reports one; ignored for promotion. */
  confidence: number | null;
}

/**
 * Pure trust assignment. No I/O, no mutation of `text`, no RTL reordering.
 */
export const assignExtractionTrust = (
  input: ExtractionTrustInput,
): ExtractionTrust => {
  if (input.method === 'OCR') {
    // C.3.5: OCR is never TRUSTED, regardless of confidence.
    if (input.text.length === 0) {
      return 'UNUSABLE';
    }
    return 'REVIEW_REQUIRED';
  }

  // TEXT_LAYER
  if (input.text.length === 0) {
    return 'UNUSABLE';
  }

  if (
    input.warnings.includes(PDF_TEXT_VISUAL_ORDER) ||
    pageContainsArabicScript(input.text)
  ) {
    return 'REVIEW_REQUIRED';
  }

  return 'TRUSTED';
};

/** Pages allowed into embed/LLM stages. */
export const isTrustedForDownstream = (page: {
  trust: ExtractionTrust;
  text: string;
}): boolean => page.trust === 'TRUSTED' && page.text.length > 0;
