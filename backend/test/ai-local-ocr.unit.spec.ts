import { accessSync } from 'node:fs';
import { resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';

import { LocalOcrProvider } from '../src/modules/ai/providers/ocr/local-ocr.provider';
import {
  OCR_FIXTURE_TEXTS,
  renderTextPng,
} from './fixtures/ocr-image-fixtures';

const langPath = resolve('.ocr-data');
const langReady = (() => {
  try {
    accessSync(resolve(langPath, 'ara.traineddata'));
    accessSync(resolve(langPath, 'eng.traineddata'));
    return true;
  } catch {
    return false;
  }
})();

const createProvider = (): LocalOcrProvider => {
  const configService = {
    get: () => ({
      ocrLangPath: langPath,
      ocrLanguages: 'ara+eng',
      ocrTimeoutMs: 60_000,
    }),
  } as unknown as ConfigService<never, true>;
  return new LocalOcrProvider(configService);
};

const describeIfReady = langReady ? describe : describe.skip;

describe('LocalOcrProvider — provisioning failures', () => {
  it('fails closed when language data is missing', async () => {
    const configService = {
      get: () => ({
        ocrLangPath: resolve('.ocr-data-missing'),
        ocrLanguages: 'ara+eng',
        ocrTimeoutMs: 5_000,
      }),
    } as unknown as ConfigService<never, true>;
    const provider = new LocalOcrProvider(configService);

    await expect(
      provider.recognise({
        image: renderTextPng('hello'),
        mimeType: 'image/png',
        languageHints: ['ar', 'en'],
        pageNumber: 1,
      }),
    ).rejects.toMatchObject({ code: 'OCR_LANGUAGE_DATA_MISSING' });
  });

  it('rejects empty image bytes', async () => {
    if (!langReady) {
      return;
    }
    const provider = createProvider();
    await expect(
      provider.recognise({
        image: Buffer.alloc(0),
        mimeType: 'image/png',
        languageHints: ['ar'],
        pageNumber: 1,
      }),
    ).rejects.toMatchObject({ code: 'OCR_FAILED' });
    await provider.onModuleDestroy();
  });
});

describeIfReady('LocalOcrProvider — real engine', () => {
  jest.setTimeout(120_000);

  let provider: LocalOcrProvider;

  beforeAll(() => {
    provider = createProvider();
  });

  afterAll(async () => {
    await provider.onModuleDestroy();
  });

  it('recognises a pure Arabic sentence', async () => {
    const result = await provider.recognise({
      image: renderTextPng(OCR_FIXTURE_TEXTS.pureArabic),
      mimeType: 'image/png',
      languageHints: ['ar', 'en'],
      pageNumber: 1,
    });

    expect(result.engine).toBe('tesseract-js-local-v1');
    expect(result.text.replace(/\s+/g, '')).toContain('قضية');
    expect(result.text).toContain('هذه');
  });

  it('keeps Latin digits present in a mixed line', async () => {
    const result = await provider.recognise({
      image: renderTextPng(OCR_FIXTURE_TEXTS.latinDigits),
      mimeType: 'image/png',
      languageHints: ['ar', 'en'],
      pageNumber: 1,
    });

    expect(result.text).toMatch(/12345/);
  });

  it('keeps English tokens in a mixed Arabic/English line', async () => {
    const result = await provider.recognise({
      image: renderTextPng(OCR_FIXTURE_TEXTS.arabicEnglish),
      mimeType: 'image/png',
      languageHints: ['ar', 'en'],
      pageNumber: 1,
    });

    expect(result.text).toMatch(/Rental|Agreement/i);
    expect(result.text).toMatch(/قضية|هذه/);
  });

  it('returns an empty warning for a blank white image', async () => {
    const result = await provider.recognise({
      image: renderTextPng(''),
      mimeType: 'image/png',
      languageHints: ['ar', 'en'],
      pageNumber: 1,
    });

    expect(result.text).toBe('');
    expect(result.warnings).toContain('OCR_EMPTY_RESULT');
  });

  it('does not accept storage keys or user identity', () => {
    const input = {
      image: renderTextPng('x'),
      mimeType: 'image/png',
      languageHints: ['ar'],
      pageNumber: 1,
    };
    expect(Object.keys(input).sort()).toEqual([
      'image',
      'languageHints',
      'mimeType',
      'pageNumber',
    ]);
  });
});
