import { existsSync } from 'node:fs';

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const ARABIC_FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
];

const LATIN_FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
];

let arabicFamily = 'sans-serif';
let latinFamily = 'sans-serif';
let fontsReady = false;

/**
 * Sans-serif on this image is DejaVu, whose Arabic glyphs Tesseract reads as
 * tatweel noise. A single fillText of mixed Arabic and Latin also collapses
 * the Arabic. Register a Noto face and draw each script on its own line.
 */
const ensureOcrFonts = (): void => {
  if (fontsReady) {
    return;
  }
  fontsReady = true;
  const arabic = ARABIC_FONT_CANDIDATES.find((candidate) => existsSync(candidate));
  const latin = LATIN_FONT_CANDIDATES.find((candidate) => existsSync(candidate));
  if (arabic) {
    GlobalFonts.registerFromPath(arabic, 'SjsOcrArabic');
    arabicFamily = 'SjsOcrArabic';
  }
  if (latin) {
    GlobalFonts.registerFromPath(latin, 'SjsOcrLatin');
    latinFamily = 'SjsOcrLatin';
  }
};

const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Keeps one line unless both scripts are present, in which case each gets a line. */
const ocrLines = (text: string): readonly { text: string; arabic: boolean }[] => {
  const hasArabic = ARABIC_CHAR.test(text);
  const hasLatin = /[A-Za-z0-9]/.test(text);
  if (!hasArabic || !hasLatin) {
    return [{ text, arabic: hasArabic }];
  }
  const arabic = text
    .replace(/[A-Za-z0-9][A-Za-z0-9 .:'/-]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const latin = text.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [
    { text: arabic, arabic: true },
    { text: latin, arabic: false },
  ].filter((line) => line.text.length > 0);
};

/** Deterministic PNG used as an OCR fixture. Not a citizen document. */
export const renderTextPng = (
  text: string,
  options: { width?: number; height?: number; fontSize?: number } = {},
): Buffer => {
  ensureOcrFonts();
  const lines = text.length === 0 ? [] : ocrLines(text);
  const width = options.width ?? 1000;
  const fontSize = options.fontSize ?? 72;
  const lineGap = 170;
  const height = options.height ?? Math.max(280, 80 + lines.length * lineGap);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';
  lines.forEach((line, index) => {
    const y = 90 + index * lineGap;
    if (line.arabic) {
      context.font = `${fontSize}px ${arabicFamily}`;
      context.direction = 'rtl';
      context.textAlign = 'right';
      context.fillText(line.text, width - 40, y);
    } else {
      context.font = `${Math.round(fontSize * 1.5)}px ${latinFamily}`;
      context.direction = 'ltr';
      context.textAlign = 'left';
      context.fillText(line.text.replace(/^[\s:.,-]+/, ''), 40, y);
    }
  });
  return Buffer.from(canvas.toBuffer('image/png'));
};

export const OCR_FIXTURE_TEXTS = {
  pureArabic: 'هذه قضية إيجارية',
  arabicEnglish: 'هذه قضية Rental Agreement',
  arabicIndicDate: 'التاريخ: ١٤٤٦/٠٣/١٥',
  latinDigits: 'رقم القضية: 12345',
  arabicPunctuation: 'البند الأول: يلتزم الطرف الأول.',
  legalClause: 'المادة ٥: (أ) يلتزم الطرف الثاني.',
  mixedClause: 'العقد رقم Contract No. 12/A',
  multiline: 'السطر الأول من العقد',
} as const;
