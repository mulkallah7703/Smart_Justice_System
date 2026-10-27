import { existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

/** Sentence used by the scanned-Arabic OCR proof. */
export const ARABIC_SCAN_TEXT = 'عقد إيجار المادة الرابعة يلتزم الطرف الأول';

const ARABIC_FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
];

let registeredFamily: string | null | undefined;

/**
 * Registers a shaping-capable Arabic font when the host has one.
 * DejaVu's Arabic coverage is not reliable enough for Tesseract.
 */
export const arabicOcrFontFamily = (): string | null => {
  if (registeredFamily !== undefined) {
    return registeredFamily;
  }
  const path = ARABIC_FONT_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!path) {
    registeredFamily = null;
    return null;
  }
  GlobalFonts.registerFromPath(path, 'SjsArabicTest');
  registeredFamily = 'SjsArabicTest';
  return registeredFamily;
};

/**
 * One-page PDF whose only content is an RGB image. No text operators, so the
 * extractor must render and OCR it.
 */
export const buildImagePdf = (
  rgb: Buffer,
  width: number,
  height: number,
): Buffer => {
  if (rgb.byteLength !== width * height * 3) {
    throw new Error('scanned pdf fixture: rgb byte length does not match the image');
  }

  const compressed = deflateSync(rgb);
  const displayWidth = Math.min(560, width);
  const displayHeight = Math.max(1, Math.round((height / width) * displayWidth));
  const content =
    `q\n${displayWidth} 0 0 ${displayHeight} 26 400 cm\n/Im1 Do\nQ\n`;

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let position = 0;

  const append = (value: Buffer | string): void => {
    const buffer = typeof value === 'string' ? Buffer.from(value, 'latin1') : value;
    chunks.push(buffer);
    position += buffer.length;
  };

  const add = (objectNumber: number, body: Buffer | string): void => {
    offsets[objectNumber] = position;
    append(`${objectNumber} 0 obj\n`);
    append(body);
    append('\nendobj\n');
  };

  append('%PDF-1.4\n');
  add(1, '<</Type /Catalog /Pages 2 0 R>>');
  add(2, '<</Type /Pages /Kids [3 0 R] /Count 1>>');
  add(
    3,
    '<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources <</XObject <</Im1 4 0 R>>>> /Contents 5 0 R>>',
  );

  const imageHeader = Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
      `/Length ${compressed.length} >>\nstream\n`,
    'latin1',
  );
  add(
    4,
    Buffer.concat([imageHeader, compressed, Buffer.from('\nendstream', 'latin1')]),
  );

  const contentBytes = Buffer.from(content, 'latin1');
  add(
    5,
    Buffer.concat([
      Buffer.from(`<</Length ${contentBytes.length}>>\nstream\n`, 'latin1'),
      contentBytes,
      Buffer.from('\nendstream', 'latin1'),
    ]),
  );

  const highest = 5;
  const xref = position;
  append(`xref\n0 ${highest + 1}\n`);
  append('0000000000 65535 f \n');
  for (let objectNumber = 1; objectNumber <= highest; objectNumber += 1) {
    append(`${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`);
  }
  append(
    `trailer\n<</Size ${highest + 1} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`,
  );

  return Buffer.concat(chunks);
};

/** Image-only page with a black rectangle, used to prove pixels survive rendering. */
export const markedImagePdf = (): Buffer => {
  const width = 80;
  const height = 40;
  const rgb = Buffer.alloc(width * height * 3, 255);
  for (let y = 8; y < 32; y += 1) {
    for (let x = 10; x < 60; x += 1) {
      const index = (y * width + x) * 3;
      rgb[index] = 0;
      rgb[index + 1] = 0;
      rgb[index + 2] = 0;
    }
  }
  return buildImagePdf(rgb, width, height);
};

/**
 * Scanned page: Arabic painted with a real font and embedded as an image.
 * Returns null when this machine has no Arabic font to draw with.
 */
export const arabicScannedPdf = (): Buffer | null => {
  const family = arabicOcrFontFamily();
  if (!family) {
    return null;
  }

  const width = 1600;
  const height = 320;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';
  context.font = `72px ${family}`;
  context.direction = 'rtl';
  context.fillText(ARABIC_SCAN_TEXT, 80, 190);

  const image = context.getImageData(0, 0, width, height);
  const rgb = Buffer.alloc(width * height * 3);
  for (let source = 0, target = 0; source < image.data.length; source += 4, target += 3) {
    rgb[target] = image.data[source]!;
    rgb[target + 1] = image.data[source + 1]!;
    rgb[target + 2] = image.data[source + 2]!;
  }
  return buildImagePdf(rgb, width, height);
};
