import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, PSM, type Worker } from 'tesseract.js';

import type { AppConfig } from '../../../../config/env.validation';
import {
  ocrFailed,
  ocrLanguageDataMissing,
  ocrTimeout,
  ocrUnavailable,
} from '../../ai.errors';
import type {
  OcrPageInput,
  OcrPageResult,
  OcrProvider,
} from '../ocr-provider.interface';

/**
 * In-process OCR via tesseract.js (WASM). Citizen document images never leave
 * the worker host. Language data is read from a local directory that must be
 * provisioned ahead of time — never downloaded at recognition time.
 */
@Injectable()
export class LocalOcrProvider implements OcrProvider, OnModuleDestroy {
  readonly name = 'tesseract-js-local-v1';

  private worker: Worker | null = null;
  private initPromise: Promise<Worker> | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initPromise = null;
    }
  }

  async recognise(input: OcrPageInput): Promise<OcrPageResult> {
    if (!Buffer.isBuffer(input.image) || input.image.byteLength === 0) {
      throw ocrFailed();
    }

    const { ocrTimeoutMs } = this.configService.get('ai', { infer: true });
    const worker = await this.getWorker();

    try {
      if (input.pass === 'header-digits') {
        await worker.setParameters({
          tessedit_char_whitelist:
            '0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹/-. ',
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
      } else {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
      }
      const recognised = await withTimeout(
        worker.recognize(input.image),
        ocrTimeoutMs,
      );
      if (input.pass === 'header-digits') {
        await worker.setParameters({ tessedit_char_whitelist: '' });
      }

      const text = recognised.data.text.replace(/\r\n?/g, '\n').trim();
      const confidence =
        typeof recognised.data.confidence === 'number'
          ? recognised.data.confidence
          : null;

      return {
        text,
        confidence,
        language: input.languageHints[0] ?? null,
        warnings: text.length === 0 ? ['OCR_EMPTY_RESULT'] : [],
        engine: this.name,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string'
      ) {
        throw error;
      }
      throw ocrFailed();
    }
  }

  private async getWorker(): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }
    if (!this.initPromise) {
      this.initPromise = this.createWorker().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    this.worker = await this.initPromise;
    return this.worker;
  }

  private async createWorker(): Promise<Worker> {
    const { ocrLangPath, ocrLanguages } = this.configService.get('ai', {
      infer: true,
    });
    const langPath = resolve(ocrLangPath);
    const languages = ocrLanguages.split('+').map((part) => part.trim());

    try {
      for (const language of languages) {
        await access(join(langPath, `${language}.traineddata`));
      }
    } catch {
      throw ocrLanguageDataMissing();
    }

    try {
      // cacheMethod readOnly + gzip false: read pre-provisioned files only.
      // No CDN fetch, no write-back of citizen-adjacent cache state.
      return await createWorker(ocrLanguages, 1, {
        langPath,
        cachePath: langPath,
        cacheMethod: 'readOnly',
        gzip: false,
        logger: () => undefined,
        errorHandler: () => undefined,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'OCR_LANGUAGE_DATA_MISSING'
      ) {
        throw error;
      }
      throw ocrUnavailable();
    }
  }
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(ocrTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
