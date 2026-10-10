import { Injectable } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument, VerbosityLevel } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

import {
  pdfInvalid,
  pdfRenderFailed,
  pdfRenderLimitExceeded,
} from '../../ai.errors';
import { hasPdfSignature } from './pdf-reader';
import type {
  PdfPageRenderer,
  RenderedPage,
  RenderPageInput,
} from './pdf-page-renderer.interface';

/**
 * Renders PDF pages with pdf.js + @napi-rs/canvas entirely in memory.
 * No temporary files, no citizen path derivation, no external network.
 */
@Injectable()
export class PdfJsPageRenderer implements PdfPageRenderer {
  readonly name = 'pdfjs-canvas-v1';

  async renderPage(input: RenderPageInput): Promise<RenderedPage> {
    if (!hasPdfSignature(input.bytes)) {
      throw pdfInvalid();
    }
    if (input.pageNumber < 1) {
      throw pdfRenderFailed();
    }

    let document: PDFDocumentProxy;
    try {
      document = await getDocument({
        data: new Uint8Array(
          input.bytes.buffer,
          input.bytes.byteOffset,
          input.bytes.byteLength,
        ),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false,
        verbosity: VerbosityLevel.ERRORS,
      }).promise;
    } catch {
      throw pdfRenderFailed();
    }

    let page: PDFPageProxy | undefined;
    try {
      if (input.pageNumber > document.numPages) {
        throw pdfRenderFailed();
      }

      page = await document.getPage(input.pageNumber);
      const scale = input.dpi / 72;
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);

      if (width < 1 || height < 1) {
        throw pdfRenderFailed();
      }
      if (width * height > input.maxPixels) {
        throw pdfRenderLimitExceeded();
      }

      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      // pdf.js paints white text onto a transparent canvas by default; fill a
      // white background so OCR sees ink on paper rather than transparent noise.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      return {
        image: Buffer.from(canvas.toBuffer('image/png')),
        mimeType: 'image/png',
        width,
        height,
        pageNumber: input.pageNumber,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string' &&
        String((error as { code: string }).code).startsWith('PDF_')
      ) {
        throw error;
      }
      throw pdfRenderFailed();
    } finally {
      page?.cleanup();
      await document.destroy();
    }
  }
}
