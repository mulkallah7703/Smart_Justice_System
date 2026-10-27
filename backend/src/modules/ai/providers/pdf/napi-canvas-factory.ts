import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';

/**
 * Canvas factory pdf.js uses for temporary surfaces (images, soft masks,
 * transparency groups).
 *
 * pdfjs-dist 3.11's Node default does `require('canvas')` (node-canvas). That
 * module is not installed, and a node-canvas surface cannot be drawn onto an
 * `@napi-rs/canvas` context (`Value is non of these types CanvasElement,
 * SVGCanvas, Image`). Every canvas this factory returns is an `@napi-rs/canvas`
 * canvas, which is the same implementation as the page target.
 */
interface CanvasAndContext {
  canvas: Canvas | null;
  context: SKRSContext2D | null;
}

export class NapiCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    const canvas = createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext('2d'),
    };
  }

  reset(entry: CanvasAndContext, width: number, height: number): void {
    if (!entry.canvas || width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    entry.canvas.width = width;
    entry.canvas.height = height;
  }

  destroy(entry: CanvasAndContext): void {
    if (entry.canvas) {
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    }
    entry.canvas = null;
    entry.context = null;
  }
}
