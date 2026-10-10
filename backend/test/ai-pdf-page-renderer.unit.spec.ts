import { AppError } from '../src/shared/exceptions/app-error';
import { PdfJsPageRenderer } from '../src/modules/ai/providers/pdf/pdfjs-page-renderer';
import {
  blankPagePdf,
  englishPdf,
  manyPagesPdf,
  notAPdf,
} from './fixtures/pdf-fixtures';

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
