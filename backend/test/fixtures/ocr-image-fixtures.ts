import { createCanvas } from '@napi-rs/canvas';

/** Deterministic PNG used as an OCR fixture. Not a citizen document. */
export const renderTextPng = (
  text: string,
  options: { width?: number; height?: number; fontSize?: number } = {},
): Buffer => {
  const width = options.width ?? 900;
  const height = options.height ?? 220;
  const fontSize = options.fontSize ?? 36;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';
  context.font = `${fontSize}px sans-serif`;
  context.fillText(text, 40, Math.floor(height * 0.55));
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
