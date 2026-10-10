import { describe, expect, it } from 'vitest';

import { formatDateAr, formatDateTimeAr } from './dateFormatter';

describe('dateFormatter', () => {
  it('formats ISO dates with Arabic numerals', () => {
    const label = formatDateAr('2030-01-10T21:00:00.000Z');
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toMatch(/2030-01-10/);
    expect(label).toMatch(/[٠-٩]/);
  });

  it('formats ISO date-times with Arabic numerals', () => {
    const label = formatDateTimeAr('2030-01-15T09:00:00.000Z');
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toMatch(/T09:00:00/);
    expect(label).toMatch(/[٠-٩]/);
  });

  it('returns an empty string for invalid input', () => {
    expect(formatDateAr('not-a-date')).toBe('');
  });
});
