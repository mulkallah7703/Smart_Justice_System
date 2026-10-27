import { createCanvas, loadImage } from '@napi-rs/canvas';

import { AppError } from '../src/shared/exceptions/app-error';
import { PdfJsPageRenderer } from '../src/modules/ai/providers/pdf/pdfjs-page-renderer';
import { readPdfPages } from '../src/modules/ai/providers/pdf/pdf-reader';
import {
  blankPagePdf,
  englishPdf,
  manyPagesPdf,
  notAPdf,
} from './fixtures/pdf-fixtures';
import { markedImagePdf } from './fixtures/scanned-pdf';

/** A Buffer that owns its ArrayBuffer, which is what file uploads look like. */
const ownBuffer = (bytes: Buffer): Buffer => {
  const owned = Buffer.allocUnsafeSlow(bytes.byteLength);
  bytes.copy(owned);
  return owned;
};

const renderer = new PdfJsPageRenderer();

describe('PdfJsPageRenderer', () => {
  it('renders a single page to a PNG buffer', async () => {
    const rendered = await renderer.renderPage({
      bytes: englishPdf(),
      pageNumber: 1,
      dpi: 100,
      maxPixels: 16_777_216,
    });

    expect(rendered.mimeType).toBe('image/png');
    expect(rendered.pageNumber).toBe(1);
    expect(rendered.width).toBeGreaterThan(100);
    expect(rendered.height).toBeGreaterThan(100);
    expect(rendered.image.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )).toBe(true);
  });

  it('renders blank pages without throwing', async () => {
    const rendered = await renderer.renderPage({
      bytes: blankPagePdf(),
      pageNumber: 1,
      dpi: 72,
      maxPixels: 16_777_216,
    });

    expect(rendered.image.byteLength).toBeGreaterThan(0);
  });

  it('rejects pages beyond the pixel budget', async () => {
    await expect(
      renderer.renderPage({
        bytes: englishPdf(),
        pageNumber: 1,
        dpi: 200,
        maxPixels: 10,
      }),
    ).rejects.toMatchObject({ code: 'PDF_RENDER_LIMIT_EXCEEDED' });
  });

  it('rejects invalid PDF bytes without leaking parser detail', async () => {
    let error: AppError | undefined;
    try {
      await renderer.renderPage({
        bytes: notAPdf(),
        pageNumber: 1,
        dpi: 100,
        maxPixels: 16_777_216,
      });
    } catch (caught) {
      error = caught as AppError;
    }

    expect(error).toBeInstanceOf(AppError);
    expect(error?.code).toMatch(/^PDF_/);
    expect(JSON.stringify(error)).not.toMatch(/pdfjs|canvas|napi/i);
  });

  it('paints an image-only page instead of failing the canvas type check', async () => {
    const rendered = await renderer.renderPage({
      bytes: ownBuffer(markedImagePdf()),
      pageNumber: 1,
      dpi: 72,
      maxPixels: 16_777_216,
    });

    expect(rendered.mimeType).toBe('image/png');
    expect(rendered.image.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )).toBe(true);

    const image = await loadImage(rendered.image);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let dark = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index]! < 250 || pixels[index + 1]! < 250 || pixels[index + 2]! < 250) {
        dark += 1;
      }
    }
    expect(dark).toBeGreaterThan(20);
  });

  it('still renders after the text layer was read from an owned buffer', async () => {
    const bytes = ownBuffer(englishPdf());
    const snapshot = Buffer.from(bytes);

    const pages = await readPdfPages(bytes, 5);

    expect(pages[0]?.text).toContain('Lease');
    expect(bytes.equals(snapshot)).toBe(true);

    const rendered = await renderer.renderPage({
      bytes,
      pageNumber: 1,
      dpi: 72,
      maxPixels: 16_777_216,
    });
    expect(rendered.image.byteLength).toBeGreaterThan(8);
    expect(bytes.equals(snapshot)).toBe(true);
  });

  it('rejects an out-of-range page number', async () => {
    await expect(
      renderer.renderPage({
        bytes: manyPagesPdf(2),
        pageNumber: 9,
        dpi: 72,
        maxPixels: 16_777_216,
      }),
    ).rejects.toMatchObject({ code: 'PDF_RENDER_FAILED' });
  });
});
