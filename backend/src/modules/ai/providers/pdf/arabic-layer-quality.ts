import {
  assessTextQuality,
  MIN_OCR_TRUST_CONFIDENCE,
  toUnitConfidence,
} from '../text-quality';

/**
 * Corrupted Saudi-court text layers often still "look like letters" after a
 * letter-ratio check: presentation forms broken apart, duplicated glyph runs,
 * and a repeated watermark. Those pages should be re-read with OCR.
 *
 * Clean Arabic, including visual-order words, is not corrupted. This module
 * never rewrites the stored string.
 */

const PRESENTATION_FORM = /[\uFB50-\uFDFF\uFE70-\uFEFF]/gu;
const BASE_ARABIC_LETTER = /[\u0621-\u064A]/gu;
const TATWEEL = /\u0640/g;

export const ARABIC_LAYER_OCR_PREFERRED = 'ARABIC_LAYER_OCR_PREFERRED';

export interface ArabicLayerAssessment {
  corrupted: boolean;
  reasons: readonly string[];
  /** Higher is better. Corruption applies a penalty. */
  qualityScore: number;
}

const tokenise = (text: string): string[] =>
  text.normalize('NFKC').split(/\s+/u).filter((token) => token.length > 0);

export const assessArabicTextLayer = (text: string): ArabicLayerAssessment => {
  const reasons: string[] = [];
  const presentation = text.match(PRESENTATION_FORM)?.length ?? 0;
  const base = text.match(BASE_ARABIC_LETTER)?.length ?? 0;
  const arabicLetters = presentation + base;

  if (arabicLetters >= 12 && presentation / arabicLetters >= 0.3) {
    reasons.push('presentation_forms');
  }

  const tokens = tokenise(text);
  const arabicTokens = tokens.filter((token) => /[\u0621-\u064A]/u.test(token));
  if (arabicTokens.length >= 10) {
    const singles = arabicTokens.filter((token) => {
      const letters = token.match(/[\u0621-\u064A]/gu)?.length ?? 0;
      return letters <= 1;
    });
    if (singles.length / arabicTokens.length >= 0.45) {
      reasons.push('broken_letters');
    }
  }

  if (tokens.length >= 8) {
    let duplicates = 0;
    for (let index = 1; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      if (token.length >= 2 && token === tokens[index - 1]) {
        duplicates += 1;
      }
    }
    if (duplicates >= 3 && duplicates / tokens.length >= 0.12) {
      reasons.push('duplicated_words');
    }
  }

  const runs = text
    .normalize('NFKC')
    .replace(TATWEEL, '')
    .match(/([\u0621-\u064A])\1{3,}/gu);
  if ((runs?.length ?? 0) >= 2) {
    reasons.push('duplicated_glyph_runs');
  }

  if (tokens.length >= 12) {
    const frequency = new Map<string, number>();
    for (const token of tokens) {
      if (token.length < 3 || token.length > 24) {
        continue;
      }
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
    let peak = 0;
    for (const count of frequency.values()) {
      peak = Math.max(peak, count);
    }
    if (peak >= 4 && peak / tokens.length >= 0.08) {
      reasons.push('watermark_repetition');
    }
  }

  const quality = assessTextQuality(text);
  let qualityScore = quality.acceptable
    ? quality.letterRatio * Math.log2(2 + quality.meaningfulChars)
    : 0;
  if (reasons.length > 0) {
    qualityScore *= 0.25;
  }

  return {
    corrupted: reasons.length > 0,
    reasons,
    qualityScore,
  };
};

export const scoreExtractedText = (input: {
  text: string;
  method: 'TEXT_LAYER' | 'OCR';
  confidence: number | null;
}): number => {
  const base = assessArabicTextLayer(input.text).qualityScore;
  if (input.method !== 'OCR') {
    return base;
  }
  const confidence = toUnitConfidence(input.confidence);
  if (confidence === null) {
    return base * 0.15;
  }
  if (confidence < MIN_OCR_TRUST_CONFIDENCE) {
    return base * confidence;
  }
  return base * (0.55 + 0.45 * confidence);
};
