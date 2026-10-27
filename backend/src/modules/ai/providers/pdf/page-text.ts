import { repairLamAlef, separateGluedDigits } from './text-repairs';

/**
 * Minimal tidying of extracted page text.
 *
 * It repairs a broken lam-alef ligature (`األول` → `الأول`) and inserts a
 * space where digits are glued to letters (`بتاريخ1يناير2026`). It does not
 * strip diacritics, convert Arabic-Indic digits to ASCII, reorder words, or
 * merge pages.
 */

/**
 * Control characters that carry no textual meaning. Tab and newline are kept
 * because indentation and line breaks often encode clause structure.
 */
// eslint-disable-next-line no-control-regex
const MEANINGLESS_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const normalisePageText = (value: string): string =>
  separateGluedDigits(
    repairLamAlef(
      value
        .replace(/\r\n?/g, '\n')
        .replace(MEANINGLESS_CONTROLS, '')
        // Only the ends of the page are trimmed; leading indentation on inner lines
        // survives, since it can carry clause nesting.
        .trim(),
    ),
  );

/**
 * A page is usable when anything remains after tidying. Whitespace-only and
 * empty pages are not treated as a text layer, so they can be routed to
 * recognition instead of being recorded as successfully extracted.
 */
export const hasUsableText = (value: string): boolean => value.length > 0;
