/**
 * Minimal, reversible tidying of extracted page text.
 *
 * What this deliberately does NOT do matters more than what it does. It never
 * strips Arabic diacritics, never normalises alif or tāʾ marbūṭa, never converts
 * Arabic-Indic digits, never touches Arabic punctuation, never reorders
 * characters, and never merges lines or pages. All of those are legally
 * meaningful in Saudi legal documents and any of them would be irreversible.
 */

/**
 * Control characters that carry no textual meaning. Tab and newline are kept
 * because indentation and line breaks often encode clause structure.
 */
// eslint-disable-next-line no-control-regex
const MEANINGLESS_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const normalisePageText = (value: string): string =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(MEANINGLESS_CONTROLS, '')
    // Only the ends of the page are trimmed; leading indentation on inner lines
    // survives, since it can carry clause nesting.
    .trim();

/**
 * A page is usable when anything remains after tidying. Whitespace-only and
 * empty pages are not treated as a text layer, so they can be routed to
 * recognition instead of being recorded as successfully extracted.
 */
export const hasUsableText = (value: string): boolean => value.length > 0;
