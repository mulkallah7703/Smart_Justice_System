/**
 * Step 2.5 investigation harness.
 *
 * Runs only from the CLI / tests. Never imported by production code, so none
 * of this diagnostic detail can reach logs, Redis, or API responses.
 */
import { getDocument, VerbosityLevel } from 'pdfjs-dist';

import { buildPdf } from './pdf-fixtures';

export interface ArabicFixture {
  id: string;
  /** What a citizen typed / what logical order must equal. */
  expected: string;
  /** Multi-page documents. */
  pages?: readonly string[];
  /** Multi-line single page. */
  lines?: readonly string[];
}

export interface ObservedItem {
  str: string;
  dir: string;
  hasEOL: boolean;
  width: number;
  height: number;
  /** transform[4]=x, transform[5]=y in PDF user space. */
  x: number;
  y: number;
  fontName: string;
  transform: readonly number[];
}

export interface PageObservation {
  pageNumber: number;
  items: ObservedItem[];
  /** Current production concatenation: item.str (+ newline on hasEOL). */
  rawJoined: string;
}

export const ARABIC_ORDER_FIXTURES: readonly ArabicFixture[] = [
  { id: 'A-pure-arabic', expected: 'هذه قضية إيجارية' },
  { id: 'B-arabic-english', expected: 'هذه قضية Rental Agreement' },
  { id: 'C-arabic-indic-date', expected: 'التاريخ: ١٤٤٦/٠٣/١٥' },
  { id: 'D-english-numbers', expected: 'رقم القضية: 12345' },
  { id: 'E-arabic-punctuation', expected: 'البند الأول: يلتزم الطرف الأول.' },
  { id: 'F-mixed-punctuation', expected: 'المادة ٥: (أ) يلتزم الطرف الثاني.' },
  {
    id: 'G-multiline',
    expected: 'السطر الأول من العقد\nالسطر الثاني من العقد',
    lines: ['السطر الأول من العقد', 'السطر الثاني من العقد'],
  },
  {
    id: 'H-multipage',
    expected: 'صفحة أولى عربية\nصفحة ثانية عربية',
    pages: ['صفحة أولى عربية', 'صفحة ثانية عربية'],
  },
  {
    id: 'I-clause-markers',
    expected: 'المادة (٣): "يلتزم الطرف"؛ رقم/أ-١٢.',
  },
  {
    id: 'J-diacritics',
    expected: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ',
  },
  {
    id: 'K-arabic-english-numbers',
    expected: 'العقد رقم Contract No. ١٢٣ / 456',
  },
];

export const fixtureBytes = (fixture: ArabicFixture): Buffer => {
  if (fixture.pages) {
    return buildPdf({ pages: fixture.pages.map((text) => ({ text })) });
  }
  if (fixture.lines) {
    return buildPdf({ pages: [{ lines: fixture.lines }] });
  }
  return buildPdf({ pages: [{ text: fixture.expected }] });
};

export const observePdf = async (bytes: Buffer): Promise<PageObservation[]> => {
  const document = await getDocument({
    data: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: VerbosityLevel.ERRORS,
  }).promise;

  try {
    const pages: PageObservation[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const items: ObservedItem[] = [];
        let rawJoined = '';

        for (const item of content.items) {
          if (!('str' in item)) {
            continue;
          }
          const transform = item.transform as number[];
          items.push({
            str: item.str,
            dir: item.dir,
            hasEOL: item.hasEOL,
            width: item.width,
            height: item.height,
            x: transform[4],
            y: transform[5],
            fontName: item.fontName,
            transform: [...transform],
          });
          rawJoined += item.str;
          if (item.hasEOL) {
            rawJoined += '\n';
          }
        }

        pages.push({ pageNumber, items, rawJoined: rawJoined.trim() });
      } finally {
        page.cleanup();
      }
    }
    return pages;
  } finally {
    await document.destroy();
  }
};

/** Strategy: current production behaviour. */
export const strategyRaw = (pages: readonly PageObservation[]): string =>
  pages.map((page) => page.rawJoined).join('\n');

/**
 * Strategy: reverse every RTL item's characters (code-point wise). This is the
 * trap identified in Step 2 — it looks correct on plain Arabic and fails on
 * dates / punctuation.
 */
export const strategyNaiveRtlReverse = (
  pages: readonly PageObservation[],
): string =>
  pages
    .map((page) => {
      let text = '';
      for (const item of page.items) {
        text +=
          item.dir === 'rtl'
            ? [...item.str].reverse().join('')
            : item.str;
        if (item.hasEOL) {
          text += '\n';
        }
      }
      return text.trim();
    })
    .join('\n');

/**
 * Strategy: reverse RTL items by grapheme cluster so combining marks stay with
 * their base. Still subject to the bidi date/punctuation trap.
 */
export const strategyClusterRtlReverse = (
  pages: readonly PageObservation[],
): string =>
  pages
    .map((page) => {
      let text = '';
      for (const item of page.items) {
        text +=
          item.dir === 'rtl'
            ? (item.str.match(/\P{M}\p{M}*/gu) ?? []).reverse().join('')
            : item.str;
        if (item.hasEOL) {
          text += '\n';
        }
      }
      return text.trim();
    })
    .join('\n');

/**
 * Strategy: group by approximate Y, then within each line sort by X ascending
 * (left-to-right). That is visual order for LTR and the wrong direction for
 * Arabic paragraphs.
 */
export const strategyCoordinateLtr = (
  pages: readonly PageObservation[],
): string =>
  pages
    .map((page) => {
      const lines = groupByLine(page.items);
      return lines
        .map((line) =>
          [...line]
            .sort((a, b) => a.x - b.x)
            .map((item) => item.str)
            .join(''),
        )
        .join('\n')
        .trim();
    })
    .join('\n');

/**
 * Strategy: group by Y, then within each line sort by X descending
 * (right-to-left). Approximates Arabic visual/reading order for a single
 * script, but mixed content is ambiguous.
 */
export const strategyCoordinateRtl = (
  pages: readonly PageObservation[],
): string =>
  pages
    .map((page) => {
      const lines = groupByLine(page.items);
      return lines
        .map((line) =>
          [...line]
            .sort((a, b) => b.x - a.x)
            .map((item) => item.str)
            .join(''),
        )
        .join('\n')
        .trim();
    })
    .join('\n');

/**
 * Strategy: group by Y, then within each line order by dir-aware runs —
 * reverse the character sequence of contiguous RTL runs but leave LTR runs
 * alone. Equivalent in practice to naive RTL reverse when items already
 * carry a single direction.
 */
export const strategyDirAwareRuns = (
  pages: readonly PageObservation[],
): string =>
  pages
    .map((page) => {
      const lines = groupByLine(page.items);
      return lines
        .map((line) => {
          // Items arrive in visual sequence from pdf.js; within a line keep
          // that sequence and reverse only RTL item characters.
          return line
            .map((item) =>
              item.dir === 'rtl'
                ? [...item.str].reverse().join('')
                : item.str,
            )
            .join('');
        })
        .join('\n')
        .trim();
    })
    .join('\n');

/**
 * Strategy: reverse the *sequence* of RTL items on a line (not their
 * characters), on the hypothesis that pdf.js emits visual item order and
 * logical order is the reverse of the RTL item run. LTR items stay put.
 */
export const strategyReverseRtlItemRuns = (
  pages: readonly PageObservation[],
): string =>
  pages
    .map((page) => {
      let text = '';
      let rtlRun: ObservedItem[] = [];

      const flushRtl = (): void => {
        for (const item of rtlRun.reverse()) {
          text += item.str;
        }
        rtlRun = [];
      };

      for (const item of page.items) {
        if (item.dir === 'rtl') {
          rtlRun.push(item);
        } else {
          flushRtl();
          text += item.str;
        }
        if (item.hasEOL) {
          flushRtl();
          text += '\n';
        }
      }
      flushRtl();
      return text.trim();
    })
    .join('\n');

const groupByLine = (
  items: readonly ObservedItem[],
): ObservedItem[][] => {
  if (items.length === 0) {
    return [];
  }

  // Items whose Y differs by less than half a font height share a line.
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: ObservedItem[][] = [];
  let current: ObservedItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  let currentHeight = Math.max(sorted[0].height, 1);

  for (let index = 1; index < sorted.length; index += 1) {
    const item = sorted[index];
    const threshold = Math.max(currentHeight, item.height, 1) * 0.5;
    if (Math.abs(item.y - currentY) <= threshold) {
      current.push(item);
      currentHeight = Math.max(currentHeight, item.height);
    } else {
      lines.push(current);
      current = [item];
      currentY = item.y;
      currentHeight = Math.max(item.height, 1);
    }
  }
  lines.push(current);
  return lines;
};

export type StrategyName =
  | 'raw'
  | 'naiveRtlReverse'
  | 'clusterRtlReverse'
  | 'coordinateLtr'
  | 'coordinateRtl'
  | 'dirAwareRuns'
  | 'reverseRtlItemRuns';

export const STRATEGIES: Record<
  StrategyName,
  (pages: readonly PageObservation[]) => string
> = {
  raw: strategyRaw,
  naiveRtlReverse: strategyNaiveRtlReverse,
  clusterRtlReverse: strategyClusterRtlReverse,
  coordinateLtr: strategyCoordinateLtr,
  coordinateRtl: strategyCoordinateRtl,
  dirAwareRuns: strategyDirAwareRuns,
  reverseRtlItemRuns: strategyReverseRtlItemRuns,
};
