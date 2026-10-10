import { normalizeForEmbedding } from '../src/modules/ai/chunking/text-normalize';

describe('normalizeForEmbedding', () => {
  it('applies NFC and collapses whitespace without stripping Arabic letters', () => {
    const input = 'مرحبا\u064B   بالعالم';
    const out = normalizeForEmbedding(input);
    expect(out).toBe(out.normalize('NFC'));
    expect(out).toContain('مرحبا');
    expect(out).toContain('بالعالم');
    expect(out.includes('  ')).toBe(false);
  });

  it('does not invent content for empty input', () => {
    expect(normalizeForEmbedding('')).toBe('');
  });
});
