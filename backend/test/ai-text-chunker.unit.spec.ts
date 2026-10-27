import {
  chunkPageText,
  chunkRulingPage,
  DEFAULT_AI_CHUNK_MAX_CHARS,
  isCodeUnitBoundary,
} from '../src/modules/ai/chunking/text-chunker';

const assertExactSubstrings = (pageText: string): void => {
  const spans = chunkPageText(pageText, 40);
  for (const span of spans) {
    expect(pageText.slice(span.startOffset, span.endOffset)).toBe(span.text);
    expect(isCodeUnitBoundary(pageText, span.startOffset)).toBe(true);
    expect(isCodeUnitBoundary(pageText, span.endOffset)).toBe(true);
  }
};

describe('chunkPageText', () => {
  it('uses a conservative default max of 2000', () => {
    expect(DEFAULT_AI_CHUNK_MAX_CHARS).toBe(2000);
  });

  it('returns no chunks for empty text', () => {
    expect(chunkPageText('')).toEqual([]);
  });

  it('returns a single chunk when text fits', () => {
    const text = 'Article 12 of the lease.';
    expect(chunkPageText(text, 200)).toEqual([
      {
        chunkIndex: 0,
        text,
        startOffset: 0,
        endOffset: text.length,
      },
    ]);
  });

  it('is deterministic', () => {
    const text = 'A'.repeat(100) + '\n\n' + 'B'.repeat(100);
    expect(chunkPageText(text, 80)).toEqual(chunkPageText(text, 80));
  });

  it('prefers paragraph boundaries', () => {
    const text = `${'a'.repeat(30)}\n\n${'b'.repeat(30)}`;
    const spans = chunkPageText(text, 40);
    expect(spans.length).toBeGreaterThanOrEqual(2);
    expect(spans[0].text.endsWith('\n\n') || spans[0].endOffset <= 32).toBe(
      true,
    );
    assertExactSubstrings(text);
  });

  it('hard-splits long lines without spaces', () => {
    const text = 'x'.repeat(100);
    const spans = chunkPageText(text, 30);
    expect(spans.every((span) => span.text.length <= 30)).toBe(true);
    expect(spans.map((span) => span.text).join('')).toBe(text);
    assertExactSubstrings(text);
  });

  it('splits long paragraphs deterministically', () => {
    const text = `${'word '.repeat(50)}end`;
    const spans = chunkPageText(text, 40);
    expect(spans.length).toBeGreaterThan(1);
    expect(spans.map((span) => span.chunkIndex)).toEqual(
      spans.map((_, index) => index),
    );
    assertExactSubstrings(text);
  });

  it('preserves Arabic, digits, punctuation, and diacritics exactly', () => {
    const text = 'هذه قضية ١٤٤٦/٠٣/١٥ ؛ مع التَّشكيل';
    const [span] = chunkPageText(text, 200);
    expect(span.text).toBe(text);
    expect(span.text).toContain('١٤٤٦');
    expect(span.text).toContain('؛');
    expect(span.text).toMatch(/[\u064B-\u0652]/);
  });

  it('preserves mixed scripts and Latin digits', () => {
    const text = 'العقد رقم Contract No. 12/A';
    expect(chunkPageText(text, 200)[0].text).toBe(text);
  });

  it('does not split surrogate pairs (emoji)', () => {
    const text = `${'a'.repeat(8)}😀${'b'.repeat(8)}`;
    const spans = chunkPageText(text, 10);
    for (const span of spans) {
      expect(span.text).toBe(text.slice(span.startOffset, span.endOffset));
      expect(isCodeUnitBoundary(text, span.startOffset)).toBe(true);
      expect(isCodeUnitBoundary(text, span.endOffset)).toBe(true);
      // No lone surrogates in chunk text.
      for (let i = 0; i < span.text.length; i += 1) {
        const code = span.text.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
          expect(i + 1 < span.text.length).toBe(true);
          const low = span.text.charCodeAt(i + 1);
          expect(low >= 0xdc00 && low <= 0xdfff).toBe(true);
        }
        if (code >= 0xdc00 && code <= 0xdfff) {
          expect(i > 0).toBe(true);
          const high = span.text.charCodeAt(i - 1);
          expect(high >= 0xd800 && high <= 0xdbff).toBe(true);
        }
      }
    }
  });

  it('handles multiline text without mutating newlines', () => {
    const text = 'line1\nline2\nline3';
    const spans = chunkPageText(text, 200);
    expect(spans[0].text).toBe(text);
  });

  it('supports configurable overlap while preserving slice integrity', () => {
    const text = 'abcdefghijKLMNOPQRST';
    const noOverlap = chunkPageText(text, 10, 0);
    const withOverlap = chunkPageText(text, { maxChars: 10, overlap: 3 });
    expect(withOverlap.length).toBeGreaterThan(noOverlap.length);
    for (const span of withOverlap) {
      expect(text.slice(span.startOffset, span.endOffset)).toBe(span.text);
    }
    for (let i = 1; i < withOverlap.length; i += 1) {
      expect(withOverlap[i].startOffset).toBeLessThan(
        withOverlap[i - 1].endOffset,
      );
      expect(withOverlap[i].startOffset).toBeGreaterThan(
        withOverlap[i - 1].startOffset,
      );
    }
  });

  it('keeps Saudi ruling sections and exact substrings', () => {
    const page =
      'رقم القضية 7890\nالوقائع\nادعت الأم.\nالأسباب\nدفع الأب.\nمنطوق الحكم\nحضانة الأب.';
    const spans = chunkRulingPage(page, 500);
    expect(spans.map((span) => span.section)).toEqual([
      'HEADER',
      'FACTS',
      'REASONS',
      'RULING',
    ]);
    for (const span of spans) {
      expect(page.slice(span.startOffset, span.endOffset)).toBe(span.text);
    }
    expect(spans.find((span) => span.section === 'RULING')?.text).toContain(
      'حضانة الأب',
    );
    expect(spans.find((span) => span.section === 'REASONS')?.text).toContain(
      'دفع الأب',
    );
  });

  it('rejects overlap >= maxChars', () => {
    expect(() => chunkPageText('abcdef', { maxChars: 4, overlap: 4 })).toThrow(
      /AI_CHUNK_OVERLAP/,
    );
  });
});
