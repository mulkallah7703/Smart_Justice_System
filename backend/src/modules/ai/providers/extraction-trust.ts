import {
  assessTextQuality,
  MIN_OCR_TRUST_CONFIDENCE,
  toUnitConfidence,
} from './text-quality';

/**
 * Per-page suitability for automatic downstream use (embeddings / RAG).
 *
 * Only `TRUSTED` pages are chunked and embedded. Readable text passes,
 * including Arabic text-layer and OCR output. Script identity is not a block.
 * Garbled text and low-confidence OCR stay `REVIEW_REQUIRED`. Empty text is
 * `UNUSABLE`. There is no approval API: the gate is this heuristic.
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
  /** OCR page confidence when the engine reports one. Null for a text layer. */
  confidence: number | null;
}

/**
 * Pure trust assignment. No I/O, no mutation of `text`, no RTL reordering.
 * Quality scoring may NFKC-normalise a copy; the caller's string is unchanged.
 */
export const assignExtractionTrust = (
  input: ExtractionTrustInput,
): ExtractionTrust => {
  if (input.text.length === 0) {
    return 'UNUSABLE';
  }

  if (!assessTextQuality(input.text).acceptable) {
    return 'REVIEW_REQUIRED';
  }

  if (input.method === 'OCR') {
    const confidence = toUnitConfidence(input.confidence);
    // Null is "not measured" (the mock engine). A low score stays out of RAG.
    if (confidence === null || confidence < MIN_OCR_TRUST_CONFIDENCE) {
      return 'REVIEW_REQUIRED';
    }
  }

  return 'TRUSTED';
};

/** Pages allowed into embed/LLM stages. */
export const isTrustedForDownstream = (page: {
  trust: ExtractionTrust;
  text: string;
}): boolean => page.trust === 'TRUSTED' && page.text.length > 0;
