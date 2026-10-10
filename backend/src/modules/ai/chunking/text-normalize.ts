/**
 * Safe Arabic / multilingual normalization for embedding inputs only.
 * Does NOT rewrite stored DocumentPage text and does NOT change trust.
 *
 * - Unicode NFC
 * - Collapse runs of whitespace (including Arabic tatweel is kept; diacritics kept)
 * - Trim ends
 *
 * Diacritics are preserved (removing them can change legal meaning).
 */
export const normalizeForEmbedding = (text: string): string => {
  if (text.length === 0) {
    return text;
  }
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
};
