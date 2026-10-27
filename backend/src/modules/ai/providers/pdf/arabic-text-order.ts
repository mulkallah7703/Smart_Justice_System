/**
 * Arabic / RTL text-order decision for PDF text-layer extraction.
 *
 * ## Decision: OPTION B — NO SAFE RECONSTRUCTION
 *
 * pdf.js `getTextContent()` returns items whose `str` values are in **visual**
 * order for right-to-left runs. Several reconstruction strategies were tested
 * against deterministic fixtures (see `test/fixtures/arabic-order-investigation.ts`
 * and `test/ai-arabic-text-order.unit.spec.ts`). None preserved every legally
 * critical case:
 *
 * - Plain Arabic can look "fixed" by reversing RTL item characters.
 * - Arabic-Indic dates (`١٤٤٦/٠٣/١٥`) and Latin digits inside RTL runs reverse
 *   incorrectly under that same transform.
 * - Mixed Arabic/English often collapses into a single `dir=ltr` item whose
 *   Arabic portion is already visually reversed, so `dir` alone cannot recover it.
 * - Coordinate sorting cannot recover logical order from these fixtures.
 *
 * A false correction would poison later OCR context, embeddings, RAG, citations,
 * and AI answers. Until a proven-safe algorithm exists, production code MUST:
 *
 * 1. Return pdf.js text unchanged (aside from the existing minimal normalisation).
 * 2. Attach `PDF_TEXT_VISUAL_ORDER` whenever Arabic script is present on the page,
 *    so callers can see that order was not reconstructed.
 * 3. Let the text-quality gate decide trust. Readable Arabic (including
 *    presentation forms and visual order) is eligible for chunking. Garbled
 *    extraction stays `REVIEW_REQUIRED`. Script identity is not a block.
 *
 * Do not reverse strings, RTL runs, or entire pages here.
 */

/**
 * Stable warning attached to extracted pages whose text may not be in logical
 * reading order. Downstream stages must treat the content as order-unresolved.
 */
export const PDF_TEXT_VISUAL_ORDER = 'PDF_TEXT_VISUAL_ORDER';

/**
 * Arabic script including presentation-form-adjacent blocks commonly seen in
 * legal Arabic. Used only to decide whether the order warning applies — never
 * to rewrite characters.
 */
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;

/**
 * True when the page text contains Arabic letters or marks. Relies on content,
 * not pdf.js `dir`, because mixed Arabic/English often arrives as a single
 * `dir=ltr` item whose Arabic portion is already visually ordered.
 */
export const pageContainsArabicScript = (text: string): boolean =>
  ARABIC_SCRIPT.test(text);
