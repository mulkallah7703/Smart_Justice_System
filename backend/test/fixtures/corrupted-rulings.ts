import type { OcrProvider } from '../../src/modules/ai/providers/ocr-provider.interface';
import { isExtractedTextPage } from '../../src/modules/ai/providers/text-extractor.interface';

import { createPdfTextExtractor } from '../helpers/pdf-extractor-test';
import { buildPdf } from './pdf-fixtures';

const PRESENTATION: Record<string, string> = {
  ا: '\uFE8D',
  أ: '\uFE83',
  ب: '\uFE8F',
  ت: '\uFE95',
  ث: '\uFE99',
  ج: '\uFE9D',
  ح: '\uFEA1',
  خ: '\uFEA5',
  د: '\uFEA9',
  ذ: '\uFEAB',
  ر: '\uFEAD',
  ز: '\uFEAF',
  س: '\uFEB1',
  ش: '\uFEB5',
  ص: '\uFEB9',
  ض: '\uFEBD',
  ط: '\uFEC1',
  ظ: '\uFEC5',
  ع: '\uFEC9',
  غ: '\uFECD',
  ف: '\uFED1',
  ق: '\uFED5',
  ك: '\uFED9',
  ل: '\uFEDD',
  م: '\uFEE1',
  ن: '\uFEE5',
  ه: '\uFEE9',
  و: '\uFEED',
  ي: '\uFEF1',
  ة: '\uFE93',
  ى: '\uFEEF',
  ئ: '\uFE89',
  ء: '\uFE80',
};

export interface RulingQuestion {
  ask: string;
  expect: string;
}

export interface RulingFixture {
  id: string;
  clean: string;
  questions: readonly RulingQuestion[];
}

/** Short synthetic Saudi rulings. The clean string is what OCR should recover. */
export const RULINGS: readonly RulingFixture[] = [
  {
    id: 'commercial-inspection',
    clean:
      'حكمت الدائرة برفض دعوى التفتيش على الشركة ذات المسؤولية المحدودة لانتفاء الصفة. رقم القضية 4521. تاريخ الحكم 15 ربيع الآخر 1446. الحكم نهائي غير قابل للاعتراض.',
    questions: [
      { ask: 'ما نتيجة دعوى التفتيش؟', expect: 'رفض دعوى التفتيش' },
      { ask: 'ما نوع الشركة؟', expect: 'الشركة ذات المسؤولية المحدودة' },
      { ask: 'ما الشهر الهجري للحكم؟', expect: 'ربيع الآخر' },
      { ask: 'هل يجوز الاعتراض الآن؟', expect: 'غير قابل للاعتراض' },
    ],
  },
  {
    id: 'criminal-whatsapp',
    clean:
      'حكمت المحكمة ببراءة المتهم من تهمة المضايقة عبر واتساب لعدم كفاية الدليل. رقم القضية 7890. الحكم نهائي.',
    questions: [
      { ask: 'ما منطوق الحكم الجزائي؟', expect: 'براءة المتهم' },
      { ask: 'ما وسيلة المضايقة؟', expect: 'واتساب' },
      { ask: 'ما رقم القضية؟', expect: '7890' },
    ],
  },
  {
    id: 'custody',
    clean:
      'حكمت المحكمة بحضانة الأب للطفل ويجوز الاعتراض خلال ثلاثين يوما من تاريخ 12 ربيع الأول 1447. الحكم غير نهائي.',
    questions: [
      { ask: 'لمن الحضانة؟', expect: 'حضانة الأب' },
      { ask: 'ما مهلة الاعتراض؟', expect: 'ثلاثين يوما' },
      { ask: 'ما الشهر الهجري؟', expect: 'ربيع الأول' },
      { ask: 'هل الحكم نهائي؟', expect: 'غير نهائي' },
    ],
  },
];

/** Presentation forms, broken letters, duplicated tokens, and a repeated watermark. */
export const corruptArabicTextLayer = (clean: string): string => {
  const broken = [...clean]
    .map((character) => PRESENTATION[character] ?? character)
    .join(' ');
  const duplicated = broken
    .split(' ')
    .filter((token) => token.length > 0)
    .map((token, index) => (index % 4 === 0 ? `${token} ${token}` : token))
    .join(' ');
  const watermark = Array.from({ length: 8 }, () => 'نسخة').join(' ');
  return `${duplicated}\n${watermark}\n${watermark}`;
};

export const answerAccuracy = (
  text: string,
  questions: readonly RulingQuestion[],
): number => {
  if (questions.length === 0) {
    return 0;
  }
  const hits = questions.filter((question) => text.includes(question.expect)).length;
  return hits / questions.length;
};

export interface RulingEvalReport {
  textLayerAccuracy: number;
  chosenAccuracy: number;
  pages: Array<{ id: string; method: string; trust: string; accuracy: number }>;
}

/** Extracts synthetic corrupted rulings and scores a fixed Arabic question set. */
export const evaluateCorruptedRulings = async (): Promise<RulingEvalReport> => {
  const corrupted = RULINGS.map((ruling) => corruptArabicTextLayer(ruling.clean));
  const pdf = buildPdf({
    pages: corrupted.map((text) => ({ text })),
  });
  const ocr: OcrProvider = {
    name: 'ruling-oracle',
    recognise: (input) =>
      Promise.resolve({
        text: RULINGS[input.pageNumber - 1]?.clean ?? '',
        confidence: 93,
        language: 'ara',
        warnings: [],
        engine: 'ruling-oracle',
      }),
  };
  const extracted = await createPdfTextExtractor({ ocr }).extract({
    documentId: 'ruling-eval',
    bytes: pdf,
    mimeType: 'application/pdf',
    languageHints: ['ar'],
  });

  const questions = RULINGS.flatMap((ruling) => ruling.questions);
  const textLayerAccuracy = answerAccuracy(corrupted.join('\n'), questions);
  const pages = extracted.pages.filter(isExtractedTextPage);
  const chosenAccuracy = answerAccuracy(
    pages.map((page) => page.text).join('\n'),
    questions,
  );

  return {
    textLayerAccuracy,
    chosenAccuracy,
    pages: pages.map((page, index) => ({
      id: RULINGS[index]?.id ?? String(page.pageNumber),
      method: page.method,
      trust: page.trust,
      accuracy: answerAccuracy(page.text, RULINGS[index]?.questions ?? []),
    })),
  };
};
