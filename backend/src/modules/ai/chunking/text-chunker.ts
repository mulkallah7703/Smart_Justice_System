/**
 * Deterministic legal text chunking. Pure: no I/O, no mutation of the source
 * string beyond slicing, no Arabic/RTL rewriting. Every returned span satisfies:
 *
 *   pageText.slice(startOffset, endOffset) === text
 *
 * Offsets are UTF-16 code-unit indices into the original page string.
 * Split points never fall inside a surrogate pair.
 */

export type RulingSection = 'HEADER' | 'FACTS' | 'REASONS' | 'RULING' | 'BODY';

export interface TextChunkSpan {
  /** Zero-based order within a single page. */
  chunkIndex: number;
  /** Exact substring of the source page text. */
  text: string;
  startOffset: number;
  endOffset: number;
  /** Saudi ruling section when a heading was found. */
  section?: RulingSection;
}

/** Default max UTF-16 length per chunk. Conservative for legal paragraphs. */
export const DEFAULT_AI_CHUNK_MAX_CHARS = 2000;

/** Default overlap between consecutive chunks (UTF-16). 0 preserves legacy behaviour. */
export const DEFAULT_AI_CHUNK_OVERLAP = 0;

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;

const isLowSurrogate = (code: number): boolean =>
  code >= 0xdc00 && code <= 0xdfff;

/** True when `index` is a safe UTF-16 boundary (not mid-surrogate-pair). */
export const isCodeUnitBoundary = (text: string, index: number): boolean => {
  if (index <= 0 || index >= text.length) {
    return true;
  }
  return !(
    isHighSurrogate(text.charCodeAt(index - 1)) &&
    isLowSurrogate(text.charCodeAt(index))
  );
};

/** Snaps an index backward to a safe UTF-16 boundary. */
const snapToBoundary = (text: string, index: number): number => {
  let i = Math.min(Math.max(index, 0), text.length);
  while (i > 0 && !isCodeUnitBoundary(text, i)) {
    i -= 1;
  }
  return i;
};

const nextCodePointEnd = (text: string, start: number): number => {
  if (start >= text.length) {
    return text.length;
  }
  const code = text.charCodeAt(start);
  if (
    isHighSurrogate(code) &&
    start + 1 < text.length &&
    isLowSurrogate(text.charCodeAt(start + 1))
  ) {
    return start + 2;
  }
  return start + 1;
};

/**
 * Preferred soft break inside [start, hardEnd): paragraph break, newline,
 * then whitespace. Returns the exclusive end offset, or null if none found.
 */
const findSoftBreak = (
  text: string,
  start: number,
  hardEnd: number,
): number | null => {
  const window = text.slice(start, hardEnd);

  const para = window.lastIndexOf('\n\n');
  if (para >= 0) {
    const end = snapToBoundary(text, start + para + 2);
    if (end > start) {
      return end;
    }
  }

  const nl = window.lastIndexOf('\n');
  if (nl >= 0) {
    const end = snapToBoundary(text, start + nl + 1);
    if (end > start) {
      return end;
    }
  }

  for (let i = window.length - 1; i >= 0; i -= 1) {
    const ch = window[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      const end = snapToBoundary(text, start + i + 1);
      if (end > start) {
        return end;
      }
    }
  }

  return null;
};

export interface ChunkPageTextOptions {
  maxChars?: number;
  /** Overlap with the previous chunk; must be < maxChars. Default 0. */
  overlap?: number;
}

/**
 * Chunks a single page's text. Empty input → []. Does not trim or rewrite.
 * Soft-breaks prefer `\n\n`, then `\n`, then spaces; otherwise hard-splits at
 * `maxChars` on a Unicode-safe boundary.
 *
 * When `overlap > 0`, the next chunk starts `overlap` units before the prior
 * end (snapped), while always advancing at least one code point.
 */
export const chunkPageText = (
  pageText: string,
  maxCharsOrOptions: number | ChunkPageTextOptions = DEFAULT_AI_CHUNK_MAX_CHARS,
  overlapArg?: number,
): readonly TextChunkSpan[] => {
  const maxChars =
    typeof maxCharsOrOptions === 'number'
      ? maxCharsOrOptions
      : (maxCharsOrOptions.maxChars ?? DEFAULT_AI_CHUNK_MAX_CHARS);
  const overlap =
    typeof maxCharsOrOptions === 'number'
      ? (overlapArg ?? DEFAULT_AI_CHUNK_OVERLAP)
      : (maxCharsOrOptions.overlap ?? DEFAULT_AI_CHUNK_OVERLAP);

  if (pageText.length === 0) {
    return [];
  }
  if (maxChars < 1) {
    throw new Error('AI_CHUNK_MAX_CHARS must be a positive integer');
  }
  if (overlap < 0) {
    throw new Error('AI_CHUNK_OVERLAP must be >= 0');
  }
  if (overlap >= maxChars) {
    throw new Error('AI_CHUNK_OVERLAP must be less than AI_CHUNK_MAX_CHARS');
  }

  const spans: TextChunkSpan[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < pageText.length) {
    const remaining = pageText.length - start;
    if (remaining <= maxChars) {
      const end = pageText.length;
      spans.push({
        chunkIndex,
        text: pageText.slice(start, end),
        startOffset: start,
        endOffset: end,
      });
      break;
    }

    let hardEnd = snapToBoundary(pageText, start + maxChars);
    if (hardEnd <= start) {
      hardEnd = nextCodePointEnd(pageText, start);
    }

    const soft = findSoftBreak(pageText, start, hardEnd);
    let end = soft !== null && soft > start ? soft : hardEnd;
    if (end <= start) {
      end = nextCodePointEnd(pageText, start);
    }

    spans.push({
      chunkIndex,
      text: pageText.slice(start, end),
      startOffset: start,
      endOffset: end,
    });
    chunkIndex += 1;

    if (overlap === 0) {
      start = end;
      continue;
    }

    let nextStart = snapToBoundary(pageText, end - overlap);
    if (nextStart <= start) {
      nextStart = nextCodePointEnd(pageText, start);
    }
    if (nextStart >= end) {
      nextStart = end;
    }
    start = nextStart;
  }

  return spans;
};

const SECTION_HEADING =
  /(?:^|\n)[ \t]*((?:منطوق الحكم|نص الحكم|أسباب الحكم|الاسباب|الأسباب|الوقائع))[ \t]*(?:[:：]|\n)/gu;

const sectionForHeading = (heading: string): RulingSection => {
  if (heading.includes('منطوق') || heading.includes('نص الحكم')) {
    return 'RULING';
  }
  if (heading.includes('سباب')) {
    return 'REASONS';
  }
  if (heading.includes('وقائع')) {
    return 'FACTS';
  }
  return 'BODY';
};

/**
 * Splits a Saudi ruling on section headings so a chunk does not mix
 * the facts, the reasons, and the ruling (منطوق الحكم). Pages without
 * those headings stay one body and match the plain chunker.
 */
export const chunkRulingPage = (
  pageText: string,
  maxCharsOrOptions: number | ChunkPageTextOptions = DEFAULT_AI_CHUNK_MAX_CHARS,
  overlapArg?: number,
): readonly TextChunkSpan[] => {
  const parts: Array<{ section: RulingSection; start: number; end: number }> = [];
  const marks: Array<{ index: number; section: RulingSection }> = [];
  for (const match of pageText.matchAll(SECTION_HEADING)) {
    const heading = match[1] ?? '';
    marks.push({
      index: match.index ?? 0,
      section: sectionForHeading(heading),
    });
  }

  if (marks.length === 0) {
    return chunkPageText(pageText, maxCharsOrOptions, overlapArg).map((span) => ({
      ...span,
      section: 'BODY' as const,
    }));
  }

  if (marks[0]!.index > 0) {
    parts.push({ section: 'HEADER', start: 0, end: marks[0]!.index });
  }
  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i]!.index;
    const end = i + 1 < marks.length ? marks[i + 1]!.index : pageText.length;
    parts.push({ section: marks[i]!.section, start, end });
  }

  const spans: TextChunkSpan[] = [];
  let chunkIndex = 0;
  for (const part of parts) {
    const local = chunkPageText(
      pageText.slice(part.start, part.end),
      maxCharsOrOptions,
      overlapArg,
    );
    for (const span of local) {
      spans.push({
        chunkIndex,
        text: span.text,
        startOffset: part.start + span.startOffset,
        endOffset: part.start + span.endOffset,
        section: part.section,
      });
      chunkIndex += 1;
    }
  }
  return spans;
};
