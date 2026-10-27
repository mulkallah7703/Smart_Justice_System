import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';

import { LocalOcrProvider } from '../../src/modules/ai/providers/ocr/local-ocr.provider';
import { normalizeOcrDigits } from '../../src/modules/ai/providers/ocr/ocr-image';
import { isExtractedTextPage } from '../../src/modules/ai/providers/text-extractor.interface';

import { createPdfTextExtractor } from '../helpers/pdf-extractor-test';
import { answerAccuracy, RULINGS, type RulingQuestion } from './corrupted-rulings';
import { FACTUAL_RULINGS, scoreFactualRulings } from './factual-rulings';
import { rulingImagePdf } from './scanned-pdf';

export interface RenderedRulingReport {
  tessdata: 'best' | 'fast' | 'missing';
  ocrAccuracy: number;
  qaAccuracy: number;
  pages: Array<{ id: string; method: string; trust: string; accuracy: number }>;
}

const tokenOverlap = (clean: string, recognised: string): number => {
  const tokens = clean.split(/\s+/).filter((token) => token.length > 1);
  if (tokens.length === 0) {
    return 0;
  }
  const haystack = normalizeOcrDigits(recognised);
  const hits = tokens.filter((token) => haystack.includes(normalizeOcrDigits(token))).length;
  return hits / tokens.length;
};

const questionHit = (text: string, questions: readonly RulingQuestion[]): number =>
  answerAccuracy(normalizeOcrDigits(text), questions.map((question) => ({
    ...question,
    expect: normalizeOcrDigits(question.expect),
  })));

const tryBestTessdata = (fastDir: string): string | null => {
  const bestDir = '/tmp/sjs-tessdata-best';
  const ara = join(bestDir, 'ara.traineddata');
  const eng = join(bestDir, 'eng.traineddata');
  try {
    if (!existsSync(ara) || statSync(ara).size < 1_000_000) {
      mkdirSync(bestDir, { recursive: true });
      execFileSync(
        'curl',
        [
          '-fsSL',
          '--max-time',
          '90',
          '-o',
          ara,
          'https://github.com/tesseract-ocr/tessdata_best/raw/main/ara.traineddata',
        ],
        { stdio: 'ignore' },
      );
    }
    if (existsSync(join(fastDir, 'eng.traineddata')) && !existsSync(eng)) {
      copyFileSync(join(fastDir, 'eng.traineddata'), eng);
    }
    if (existsSync(ara) && existsSync(eng) && statSync(ara).size > 1_000_000) {
      return bestDir;
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Renders each synthetic ruling as a real image PDF and reads it with Tesseract.
 * The oracle path used by unit tests stays in evaluateCorruptedRulings.
 */
export const evaluateRenderedRulings = async (): Promise<RenderedRulingReport> => {
  const fastDir = resolve('.ocr-data');
  const bestDir = tryBestTessdata(fastDir);
  const langPath = bestDir ?? fastDir;
  const tessdata: RenderedRulingReport['tessdata'] = bestDir
    ? 'best'
    : existsSync(join(fastDir, 'ara.traineddata'))
      ? 'fast'
      : 'missing';
  if (tessdata === 'missing') {
    return { tessdata, ocrAccuracy: 0, qaAccuracy: 0, pages: [] };
  }

  const config = {
    get: () => ({
      ocrTimeoutMs: 180_000,
      ocrLangPath: langPath,
      ocrLanguages: 'ara',
    }),
  } as unknown as ConfigService<never, true>;
  const ocr = new LocalOcrProvider(config);
  const extractor = createPdfTextExtractor({ ocr });
  const pages: RenderedRulingReport['pages'] = [];
  const overlaps: number[] = [];
  const recognised: string[] = [];

  try {
    for (const ruling of RULINGS) {
      const pdf = rulingImagePdf(ruling.clean);
      if (!pdf) {
        pages.push({
          id: ruling.id,
          method: 'FONT_MISSING',
          trust: 'UNUSABLE',
          accuracy: 0,
        });
        overlaps.push(0);
        continue;
      }
      const extracted = await extractor.extract({
        documentId: `render-${ruling.id}`,
        bytes: pdf,
        mimeType: 'application/pdf',
        languageHints: ['ar'],
      });
      const text = extracted.pages
        .filter(isExtractedTextPage)
        .map((page) => page.text)
        .join('\n');
      const first = extracted.pages.filter(isExtractedTextPage)[0];
      recognised.push(text);
      overlaps.push(tokenOverlap(ruling.clean, text));
      pages.push({
        id: ruling.id,
        method: first?.method ?? 'NONE',
        trust: first?.trust ?? 'UNUSABLE',
        accuracy: questionHit(text, ruling.questions),
      });
    }
  } finally {
    await ocr.onModuleDestroy();
  }

  const ocrAccuracy =
    overlaps.reduce((sum, value) => sum + value, 0) / Math.max(1, overlaps.length);
  const qaAccuracy = questionHit(
    recognised.join('\n'),
    RULINGS.flatMap((ruling) => ruling.questions),
  );
  return { tessdata, ocrAccuracy, qaAccuracy, pages };
};

export interface FactualOcrReport {
  tessdata: 'best' | 'fast' | 'missing';
  cleanAccuracy: number;
  ocrAccuracy: number;
  invertedRulingCount: number;
  deadlinesFound: number;
  deadlineQuestions: number;
  total: number;
}

/** Real Tesseract reading of the three synthetic rulings, scored by the grounding answerer. */
export const evaluateFactualRulings = async (): Promise<FactualOcrReport> => {
  const clean = scoreFactualRulings(
    new Map(FACTUAL_RULINGS.map((ruling) => [ruling.id, ruling.clean])),
  );
  const fastDir = resolve('.ocr-data');
  const bestDir = tryBestTessdata(fastDir);
  const langPath = bestDir ?? fastDir;
  const tessdata: FactualOcrReport['tessdata'] = bestDir
    ? 'best'
    : existsSync(join(fastDir, 'ara.traineddata'))
      ? 'fast'
      : 'missing';
  if (tessdata === 'missing') {
    return {
      tessdata,
      cleanAccuracy: clean.accuracy,
      ocrAccuracy: 0,
      invertedRulingCount: clean.invertedRulingCount,
      deadlinesFound: 0,
      deadlineQuestions: clean.deadlineQuestions,
      total: clean.total,
    };
  }

  const config = {
    get: () => ({
      ocrTimeoutMs: 180_000,
      ocrLangPath: langPath,
      ocrLanguages: 'ara',
      ocrConcurrency: 2,
    }),
  } as unknown as ConfigService<never, true>;
  const ocr = new LocalOcrProvider(config);
  const extractor = createPdfTextExtractor({ ocr });
  const texts = new Map<string, string>();
  try {
    for (const ruling of FACTUAL_RULINGS) {
      const pdf = rulingImagePdf(ruling.clean);
      if (!pdf) {
        texts.set(ruling.id, '');
        continue;
      }
      const extracted = await extractor.extract({
        documentId: `factual-${ruling.id}`,
        bytes: pdf,
        mimeType: 'application/pdf',
        languageHints: ['ar'],
      });
      texts.set(
        ruling.id,
        extracted.pages
          .filter(isExtractedTextPage)
          .map((page) => page.text)
          .join('\n'),
      );
    }
  } finally {
    await ocr.onModuleDestroy();
  }
  const ocrScore = scoreFactualRulings(texts);
  return {
    tessdata,
    cleanAccuracy: clean.accuracy,
    ocrAccuracy: ocrScore.accuracy,
    invertedRulingCount: ocrScore.invertedRulingCount,
    deadlinesFound: ocrScore.deadlinesFound,
    deadlineQuestions: ocrScore.deadlineQuestions,
    total: ocrScore.total,
  };
};
