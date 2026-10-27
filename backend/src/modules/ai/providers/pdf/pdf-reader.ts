import { getDocument, VerbosityLevel } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import {
  pdfEncrypted,
  pdfExtractionFailed,
  pdfInvalid,
  pdfPageLimitExceeded,
} from '../../ai.errors';

import { normalisePageText } from './page-text';
import { pageContainsArabicScript } from './arabic-text-order';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

export interface PdfPageText {
  /** One-based. */
  pageNumber: number;
  text: string;
  /**
   * True when the page contains Arabic script (or any rtl-directed item).
   * Signals that `text` may be visual-order rather than logical-order — see
   * `arabic-text-order.ts`. Never used to rewrite the text.
   */
  orderUnresolved: boolean;
}

/**
 * The upload path already validated the magic bytes, but extraction re-checks
 * them: this layer must not assume the database row still describes the object.
 */
export const hasPdfSignature = (bytes: Buffer): boolean =>
  bytes.length >= PDF_SIGNATURE.length &&
  bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);

/** Library failures are collapsed to stable codes; no parser text escapes. */
const mapOpenError = (error: unknown): Error => {
  const name = (error as { name?: string } | null)?.name;

  if (name === 'PasswordException') {
    return pdfEncrypted();
  }
  if (name === 'InvalidPDFException') {
    return pdfInvalid();
  }
  return pdfExtractionFailed();
};

const readPage = async (
  document: PDFDocumentProxy,
  pageNumber: number,
): Promise<PdfPageText> => {
  const page = await document.getPage(pageNumber);

  try {
    const content = await page.getTextContent();

    let text = '';
    let sawRtlDir = false;

    for (const item of content.items) {
      // Marked-content entries carry no text and are skipped.
      if (!('str' in item)) {
        continue;
      }
      // Visual order is returned as-is. Do not reverse, sort, or reshape —
      // see arabic-text-order.ts (Option B).
      text += item.str;
      if (item.hasEOL) {
        text += '\n';
      }
      if (item.dir === 'rtl') {
        sawRtlDir = true;
      }
    }

    const normalised = normalisePageText(text);

    return {
      pageNumber,
      text: normalised,
      orderUnresolved: sawRtlDir || pageContainsArabicScript(normalised),
    };
  } catch {
    throw pdfExtractionFailed();
  } finally {
    // Releases the page's parsed resources rather than holding them for the
    // lifetime of the document.
    page.cleanup();
  }
};

/**
 * A private copy for pdf.js.
 *
 * When the view owns its whole ArrayBuffer, pdf.js transfers that buffer to
 * its worker and detaches it. A view over the caller's Buffer then leaves the
 * upload empty, and the OCR renderer later reports `PDF_INVALID` (or throws
 * `Cannot perform Construct on a detached ArrayBuffer`). Pooled buffers smaller
 * than the Node pool happen to be copied inside pdf.js; file-sized uploads do
 * not. Always hand pdf.js its own copy.
 */
export const pdfJsData = (bytes: Buffer): Uint8Array => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

/**
 * Opens a PDF and returns its text layer, one entry per page, in order.
 *
 * Nothing is rendered: no page is rasterised and no canvas is used, so this
 * path has no native dependency. Scripting and font-face loading are disabled,
 * so an embedded script or remote font reference in a hostile document cannot
 * execute or trigger a fetch.
 */
export const readPdfPages = async (
  bytes: Buffer,
  maxPages: number,
): Promise<PdfPageText[]> => {
  if (!hasPdfSignature(bytes)) {
    throw pdfInvalid();
  }

  let document: PDFDocumentProxy;
  try {
    document = await getDocument({
      data: pdfJsData(bytes),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: VerbosityLevel.ERRORS,
    }).promise;
  } catch (error) {
    throw mapOpenError(error);
  }

  try {
    const pageCount = document.numPages;

    if (pageCount < 1) {
      throw pdfInvalid();
    }
    // Checked before any page is touched, so an oversized document costs
    // nothing beyond opening it.
    if (pageCount > maxPages) {
      throw pdfPageLimitExceeded();
    }

    const pages: PdfPageText[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      pages.push(await readPage(document, pageNumber));
    }
    return pages;
  } finally {
    await document.destroy();
  }
};
