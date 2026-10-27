import { createCanvas, loadImage } from '@napi-rs/canvas';

const INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED = '۰۱۲۳۴۵۶۷۸۹';

/** Converts Arabic-Indic digits inside OCR text to ASCII digits. */
export const normalizeOcrDigits = (text: string): string =>
  text
    .replace(/[٠-٩]/g, (digit) => String(INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED.indexOf(digit)));

/** Header digits that were not confirmed against the page body or a second pass. */
export const DIGITS_UNVERIFIED = 'DIGITS_UNVERIFIED';

export interface HeaderDigitMerge {
  text: string;
  /** True when a header pass proposed a number the body does not support. */
  digitsUnverified: boolean;
}

const digitRuns = (text: string): string[] => [
  ...(text.match(/\d{1,2}\/\d{1,2}\/\d{3,4}/g) ?? []),
  ...(text.match(/\d{4,}/g) ?? []),
];

/** A whitelist header pass is digits and separators only. Prose is ignored. */
const isDigitPass = (text: string): boolean =>
  /\d/.test(text) && /^[\d\s./-]+$/.test(text);

/**
 * A header pass never adds a case number or date. A run is kept only when
 * the page body already contains it. Any other digit-pass proposal is marked
 * unverified and left out of the text, even if a second pass repeats it.
 */
export const reconcileHeaderDigits = (
  pageText: string,
  headerText: string,
): HeaderDigitMerge => {
  const page = normalizeOcrDigits(pageText);
  const header = normalizeOcrDigits(headerText);
  if (!isDigitPass(header)) {
    return { text: page, digitsUnverified: false };
  }
  const missing = [...new Set(digitRuns(header))].some((run) => !page.includes(run));
  return { text: page, digitsUnverified: missing };
};

/** Page body only. Header-only numbers are never appended. */
export const mergeHeaderReading = (pageText: string, headerText: string): string =>
  reconcileHeaderDigits(pageText, headerText).text;

const otsuThreshold = (luminance: readonly number[]): number => {
  const hist = new Array<number>(256).fill(0);
  for (const value of luminance) {
    hist[Math.max(0, Math.min(255, Math.round(value)))] += 1;
  }
  const total = luminance.length || 1;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * hist[i]!;
  }
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 160;
  for (let i = 0; i < 256; i += 1) {
    weightBackground += hist[i]!;
    if (weightBackground === 0) {
      continue;
    }
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) {
      break;
    }
    sumBackground += i * hist[i]!;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
};

/**
 * Grayscale, drop light watermark ink, then binarize.
 * A small deskew is applied only when the ink is clearly tilted.
 */
export const prepareOcrPng = async (png: Buffer): Promise<Buffer> => {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, image.width, image.height);
  context.drawImage(image, 0, 0);
  const frame = context.getImageData(0, 0, image.width, image.height);
  const pixels = frame.data;
  const luminance: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    luminance.push(
      pixels[i]! * 0.299 + pixels[i + 1]! * 0.587 + pixels[i + 2]! * 0.114,
    );
  }
  const threshold = otsuThreshold(luminance);
  for (let i = 0, pixel = 0; i < pixels.length; i += 4, pixel += 1) {
    const max = Math.max(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
    const min = Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
    const washed = luminance[pixel]! > 175 && max - min < 35;
    const ink = !washed && luminance[pixel]! < threshold;
    const value = ink ? 0 : 255;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  context.putImageData(frame, 0, 0);

  const angle = estimateSkewDegrees(pixels, image.width, image.height);
  if (Math.abs(angle) < 1) {
    return Buffer.from(canvas.toBuffer('image/png'));
  }

  const rotated = createCanvas(image.width, image.height);
  const rotatedContext = rotated.getContext('2d');
  rotatedContext.fillStyle = '#ffffff';
  rotatedContext.fillRect(0, 0, image.width, image.height);
  rotatedContext.translate(image.width / 2, image.height / 2);
  rotatedContext.rotate((-angle * Math.PI) / 180);
  rotatedContext.drawImage(canvas, -image.width / 2, -image.height / 2);
  return Buffer.from(rotated.toBuffer('image/png'));
};

/** Top band used for a digit-focused second pass (case numbers and dates). */
export const cropHeaderPng = async (png: Buffer): Promise<Buffer> => {
  const image = await loadImage(png);
  const height = Math.max(1, Math.round(image.height * 0.28));
  const canvas = createCanvas(image.width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, image.width, height);
  context.drawImage(image, 0, 0);
  return Buffer.from(canvas.toBuffer('image/png'));
};

const estimateSkewDegrees = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): number => {
  let bestAngle = 0;
  let bestScore = -1;
  const step = 4;
  for (let angle = -4; angle <= 4; angle += 1) {
    if (angle === 0) {
      continue;
    }
    const radians = (angle * Math.PI) / 180;
    const rows = new Map<number, number>();
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        if (pixels[index] !== 0) {
          continue;
        }
        const dy = y - height / 2;
        const dx = x - width / 2;
        const row = Math.round(dy * Math.cos(radians) + dx * Math.sin(radians));
        rows.set(row, (rows.get(row) ?? 0) + 1);
      }
    }
    let score = 0;
    for (const count of rows.values()) {
      score += count * count;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  const upright = scoreUpright(pixels, width, height, step);
  return bestScore > upright * 1.08 ? bestAngle : 0;
};

const scoreUpright = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  step: number,
): number => {
  const rows = new Map<number, number>();
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (pixels[(y * width + x) * 4] === 0) {
        rows.set(y, (rows.get(y) ?? 0) + 1);
      }
    }
  }
  let score = 0;
  for (const count of rows.values()) {
    score += count * count;
  }
  return score;
};
