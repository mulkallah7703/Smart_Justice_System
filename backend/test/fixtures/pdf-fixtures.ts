/**
 * Minimal, deterministic PDF builders for tests.
 *
 * These construct PDF bytes by hand rather than pulling in a PDF authoring
 * dependency, so fixtures stay tiny, reproducible, and free of any real
 * document content.
 *
 * Text is encoded with a single-byte code per distinct character plus a
 * ToUnicode CMap mapping those codes back to real Unicode. That is exactly how
 * a digitally generated PDF carries a text layer, so an extractor reads genuine
 * Arabic or mixed-script text out of these files. The base font has no Arabic
 * glyphs, so the fixtures would not *render* as Arabic — irrelevant here, since
 * text-layer extraction never looks at glyphs.
 */

const latin1 = (value: string): Buffer => Buffer.from(value, 'latin1');

/** Codes start above the PDF delimiters so escaping stays simple. */
const FIRST_CODE = 0x21;

export interface PdfPageSpec {
  /** Omitted or empty means the page carries no text-showing operator at all. */
  text?: string;
  /**
   * Multiple lines drawn at decreasing Y. Prefer this over embedding U+000A in
   * `text` when line boundaries themselves are under test.
   */
  lines?: readonly string[];
}

export interface BuildPdfOptions {
  pages: readonly PdfPageSpec[];
  /** Emits an /Encrypt dictionary so parsers report a protected document. */
  encrypted?: boolean;
  /** Emits /Count and an empty /Kids, i.e. a structurally page-less document. */
  forceZeroPages?: boolean;
}

interface CharacterMap {
  codeOf: Map<string, number>;
}

const buildCharacterMap = (texts: readonly string[]): CharacterMap => {
  const codeOf = new Map<string, number>();
  let next = FIRST_CODE;

  for (const text of texts) {
    // Iterating the string yields whole code points, so astral characters are
    // not split into surrogate halves.
    for (const character of text) {
      if (codeOf.has(character)) {
        continue;
      }
      codeOf.set(character, next);
      next += 1;
      if (next > 0xff) {
        throw new Error('pdf fixture: too many distinct characters');
      }
    }
  }

  return { codeOf };
};

const utf16BigEndianHex = (character: string): string =>
  [...character]
    .flatMap((part) => {
      const codePoint = part.codePointAt(0) ?? 0;
      if (codePoint <= 0xffff) {
        return [codePoint];
      }
      const offset = codePoint - 0x10000;
      return [0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff)];
    })
    .map((unit) => unit.toString(16).padStart(4, '0'))
    .join('');

const toUnicodeCMap = (map: CharacterMap): string => {
  const entries = [...map.codeOf.entries()].map(
    ([character, code]) =>
      `<${code.toString(16).padStart(2, '0')}> <${utf16BigEndianHex(character)}>`,
  );

  // A bfchar block may hold at most 100 entries.
  const blocks: string[] = [];
  for (let index = 0; index < entries.length; index += 100) {
    const chunk = entries.slice(index, index + 100);
    blocks.push(
      `${chunk.length} beginbfchar\n${chunk.join('\n')}\nendbfchar`,
    );
  }

  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Fixture-UTF16 def',
    '/CMapType 2 def',
    '/WMode 0 def',
    '1 begincodespacerange',
    '<00> <FF>',
    'endcodespacerange',
    ...blocks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
};

/** Octal-escapes every byte, which is always valid inside a PDF literal string. */
const pdfLiteralString = (text: string, map: CharacterMap): string => {
  let out = '';
  for (const character of text) {
    const code = map.codeOf.get(character);
    if (code === undefined) {
      throw new Error('pdf fixture: unmapped character');
    }
    out += `\\${code.toString(8).padStart(3, '0')}`;
  }
  return `(${out})`;
};

const contentStreamFor = (
  page: PdfPageSpec,
  map: CharacterMap,
): string => {
  const lines =
    page.lines ??
    (page.text !== undefined && page.text.length > 0 ? [page.text] : []);

  if (lines.length === 0) {
    // A real page that draws nothing: valid PDF, but no text layer.
    return '';
  }

  // Each line is a separate text object so pdf.js reports distinct Y positions
  // and hasEOL boundaries rather than absorbing a U+000A code point.
  return lines
    .map((line, index) => {
      const y = 720 - index * 18;
      return `BT /F1 12 Tf 72 ${y} Td ${pdfLiteralString(line, map)} Tj ET\n`;
    })
    .join('');
};

/**
 * Assembles the file, tracking byte offsets so the cross-reference table is
 * genuinely correct rather than relying on a parser's recovery path.
 */
export const buildPdf = (options: BuildPdfOptions): Buffer => {
  const pages = options.pages;
  const map = buildCharacterMap(
    pages.flatMap((page) => page.lines ?? (page.text ? [page.text] : [])),
  );

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let position = 0;

  const append = (value: Buffer | string): void => {
    const buffer = typeof value === 'string' ? latin1(value) : value;
    chunks.push(buffer);
    position += buffer.length;
  };

  const addObject = (objectNumber: number, body: string | Buffer): void => {
    offsets[objectNumber] = position;
    append(`${objectNumber} 0 obj\n`);
    append(body);
    append('\nendobj\n');
  };

  const stream = (dictionary: string, content: string): Buffer => {
    const payload = latin1(content);
    return Buffer.concat([
      latin1(`<<${dictionary}/Length ${payload.length}>>\nstream\n`),
      payload,
      latin1('\nendstream'),
    ]);
  };

  append('%PDF-1.4\n');
  // A binary comment marks the file as containing binary data, as real
  // producers do.
  append(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageObjectNumber = (index: number): number => 5 + index * 2;
  const contentObjectNumber = (index: number): number => 6 + index * 2;

  const kids = options.forceZeroPages
    ? ''
    : pages.map((_, index) => `${pageObjectNumber(index)} 0 R`).join(' ');
  const count = options.forceZeroPages ? 0 : pages.length;

  addObject(1, '<</Type /Catalog /Pages 2 0 R>>');
  addObject(2, `<</Type /Pages /Kids [${kids}] /Count ${count}>>`);
  addObject(
    3,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 33 /LastChar 255 /ToUnicode 4 0 R>>',
  );
  addObject(4, stream('', toUnicodeCMap(map)));

  pages.forEach((page, index) => {
    addObject(
      pageObjectNumber(index),
      `<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources <</Font <</F1 3 0 R>>>> ` +
        `/Contents ${contentObjectNumber(index)} 0 R>>`,
    );
    addObject(
      contentObjectNumber(index),
      stream('', contentStreamFor(page, map)),
    );
  });

  let encryptReference = '';
  if (options.encrypted) {
    const encryptObjectNumber = 5 + pages.length * 2;
    // A standard security handler whose stored password hashes cannot match,
    // so a parser must report the document as protected. No real encryption is
    // performed and no password is embedded.
    addObject(
      encryptObjectNumber,
      `<</Filter /Standard /V 2 /R 3 /Length 128 /P -1 ` +
        `/O <${'ab'.repeat(32)}> /U <${'cd'.repeat(32)}>>>`,
    );
    encryptReference = ` /Encrypt ${encryptObjectNumber} 0 R`;
  }

  const highestObject = offsets.length - 1;
  const xrefOffset = position;

  append(`xref\n0 ${highestObject + 1}\n`);
  append('0000000000 65535 f \n');
  for (let objectNumber = 1; objectNumber <= highestObject; objectNumber += 1) {
    const offset = offsets[objectNumber] ?? 0;
    append(`${offset.toString().padStart(10, '0')} 00000 n \n`);
  }

  append(
    `trailer\n<</Size ${highestObject + 1} /Root 1 0 R${encryptReference} ` +
      `/ID [<${'11'.repeat(16)}> <${'11'.repeat(16)}>]>>\n`,
  );
  append(`startxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
};

// ─── Named fixtures ──────────────────────────────────────────────────────────

export const ENGLISH_TEXT = 'Lease Agreement Clause 4';
export const ARABIC_TEXT = 'عقد إيجار المادة الرابعة';
export const MIXED_TEXT = 'العقد رقم Contract No. 12/A';
export const ARABIC_DIGITS_TEXT = 'المبلغ ٥٠٠٠٠ ريال';
export const ARABIC_PUNCTUATION_TEXT = 'أولاً: الطرف الأول؛ ثانياً: الطرف الثاني، والتاريخ ١٤٤٦/٠٣/١٥؟';

export const englishPdf = (): Buffer => buildPdf({ pages: [{ text: ENGLISH_TEXT }] });

export const arabicPdf = (): Buffer => buildPdf({ pages: [{ text: ARABIC_TEXT }] });

export const mixedScriptPdf = (): Buffer => buildPdf({ pages: [{ text: MIXED_TEXT }] });

export const arabicDigitsPdf = (): Buffer =>
  buildPdf({ pages: [{ text: ARABIC_DIGITS_TEXT }] });

export const arabicPunctuationPdf = (): Buffer =>
  buildPdf({ pages: [{ text: ARABIC_PUNCTUATION_TEXT }] });

/** Both pages carry a text layer. */
export const twoTextPagesPdf = (): Buffer =>
  buildPdf({ pages: [{ text: 'First page text' }, { text: 'Second page text' }] });

/** Page one has text, page two draws nothing — the mixed shape. */
export const mixedTextAndBlankPdf = (): Buffer =>
  buildPdf({ pages: [{ text: 'First page text' }, {}] });

/** A single page that draws nothing at all. */
export const blankPagePdf = (): Buffer => buildPdf({ pages: [{}] });

/** A page whose only content is whitespace, which is not usable text. */
export const whitespaceOnlyPdf = (): Buffer =>
  buildPdf({ pages: [{ text: '   ' }] });

export const manyPagesPdf = (pageCount: number): Buffer =>
  buildPdf({
    pages: Array.from({ length: pageCount }, (_, index) => ({
      text: `Page ${index + 1}`,
    })),
  });

export const encryptedPdf = (): Buffer =>
  buildPdf({ pages: [{ text: ENGLISH_TEXT }], encrypted: true });

export const zeroPagePdf = (): Buffer =>
  buildPdf({ pages: [], forceZeroPages: true });

/** Valid header, truncated before the cross-reference table. */
export const truncatedPdf = (): Buffer => {
  const full = englishPdf();
  return full.subarray(0, Math.floor(full.length / 2));
};

/** Not a PDF at all. */
export const notAPdf = (): Buffer => Buffer.from('this is plainly not a pdf file');

/** PDF signature followed by rubbish. */
export const corruptPdf = (): Buffer =>
  Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('\x00\x01\x02 garbage '.repeat(20))]);
