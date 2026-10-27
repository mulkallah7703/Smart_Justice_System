/**
 * Scoring-only quality gate for extracted page text.
 *
 * The stored page text is never rewritten. Normalisation exists so the score
 * treats Arabic fairly:
 * - NFKC folds Arabic presentation forms (U+FB50–U+FDFF, U+FE70–U+FEFF) back
 *   to their base letters, which is how many text layers expose RTL glyphs.
 * - Bidi controls and the byte-order mark are ignored so RTL marks are not
 *   counted as garbage.
 *
 * A page of real letters (Arabic or Latin, logical or visual order) passes.
 * Replacement characters, tofu, and symbol soup do not.
 */

const BIDI_AND_BOM = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/gu;

/** Replacement chars, object replacement, and private-use tofu. */
const GARBAGE =
  /[\uFFFD\uFFFC\u25A0\u25A1\uFFFE\uFFFF]|[\uE000-\uF8FF]/gu;

/** Shortest run of letters/digits that can still be a real clause or heading. */
const MIN_MEANINGFUL_CHARS = 4;

/** Letters and digits among non-space characters, after normalisation. */
const MIN_LETTER_RATIO = 0.45;

const MAX_GARBAGE_RATIO = 0.15;

/**
 * Minimum OCR confidence on a 0–1 scale.
 * Tesseract.js reports 0–100; {@link toUnitConfidence} scales that down.
 * Text-layer pages have no confidence and are judged on text quality alone.
 */
export const MIN_OCR_TRUST_CONFIDENCE = 0.6;

export interface TextQualityAssessment {
  meaningfulChars: number;
  letterRatio: number;
  garbageRatio: number;
  acceptable: boolean;
}

/** Normalised copy used only for scoring. Does not reorder characters. */
export const normaliseForQuality = (text: string): string =>
  text.normalize('NFKC').replace(BIDI_AND_BOM, '');

export const assessTextQuality = (text: string): TextQualityAssessment => {
  const compact = normaliseForQuality(text).replace(/\s+/g, '');

  if (compact.length === 0) {
    return {
      meaningfulChars: 0,
      letterRatio: 0,
      garbageRatio: 0,
      acceptable: false,
    };
  }

  const meaningful = compact.match(LETTER_OR_NUMBER)?.length ?? 0;
  const garbage = compact.match(GARBAGE)?.length ?? 0;
  const letterRatio = meaningful / compact.length;
  const garbageRatio = garbage / compact.length;

  return {
    meaningfulChars: meaningful,
    letterRatio,
    garbageRatio,
    acceptable:
      meaningful >= MIN_MEANINGFUL_CHARS &&
      letterRatio >= MIN_LETTER_RATIO &&
      garbageRatio <= MAX_GARBAGE_RATIO,
  };
};

/**
 * Maps an engine confidence to 0–1.
 * Values in (1, 100] are Tesseract's percent scale. Null when the engine did
 * not measure anything, or the number is outside both scales.
 */
export const toUnitConfidence = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value <= 1) {
    return value;
  }
  if (value <= 100) {
    return value / 100;
  }
  return null;
};
