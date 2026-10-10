export const PDF_PAGE_RENDERER = Symbol('PDF_PAGE_RENDERER');

export interface RenderPageInput {
  bytes: Buffer;
  /** One-based. */
  pageNumber: number;
  dpi: number;
  maxPixels: number;
}

export interface RenderedPage {
  image: Buffer;
  mimeType: 'image/png';
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Renders a single PDF page to a raster image. Knows nothing about OCR,
 * storage, jobs, or users.
 */
export interface PdfPageRenderer {
  readonly name: string;
  renderPage(input: RenderPageInput): Promise<RenderedPage>;
}
