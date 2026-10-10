import { Prisma } from '@prisma/client';

/**
 * All arithmetic happens in integer minor units (halalas for SAR) so no
 * monetary value is ever produced by binary floating point. Values cross the
 * Prisma boundary as Decimal and the API boundary as a fixed 2-decimal string.
 */
export const MINOR_UNITS_PER_MAJOR = 100;

export const PERCENT_BASE = 100;

/** The only currency this product sells in. Never client-supplied. */
export const DEFAULT_CURRENCY = 'SAR';

export const isSupportedCurrency = (currency: string): boolean =>
  currency === DEFAULT_CURRENCY;

export const majorToMinor = (major: number): number => {
  if (!Number.isFinite(major)) {
    throw new Error('Amount must be a finite number');
  }
  // Round rather than truncate so a value such as 1.005 cannot silently drop a
  // halala through float representation.
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
};

export const minorToDecimal = (minor: number): Prisma.Decimal => {
  if (!Number.isInteger(minor)) {
    throw new Error('Minor units must be an integer');
  }
  return new Prisma.Decimal(minor).dividedBy(MINOR_UNITS_PER_MAJOR);
};

export const decimalToMinor = (value: Prisma.Decimal): number =>
  value.times(MINOR_UNITS_PER_MAJOR).toDecimalPlaces(0).toNumber();

/** Serialised form for API responses: a fixed 2-decimal string, never a float. */
export const minorToString = (minor: number): string =>
  minorToDecimal(minor).toFixed(2);

export const isValidDiscountPct = (pct: number): boolean =>
  Number.isInteger(pct) && pct >= 0 && pct <= PERCENT_BASE;

/**
 * Applies a whole-percent discount in minor units, rounding the payable amount
 * half-up to the nearest halala. The discount is derived, never client-supplied.
 */
export const applyDiscount = (
  originalMinor: number,
  discountPct: number,
): { payableMinor: number; discountMinor: number } => {
  if (!Number.isInteger(originalMinor) || originalMinor < 0) {
    throw new Error('Original amount must be a non-negative integer minor unit');
  }
  if (!isValidDiscountPct(discountPct)) {
    throw new Error('Discount percentage must be an integer from 0 to 100');
  }

  const payableMinor = Math.round(
    (originalMinor * (PERCENT_BASE - discountPct)) / PERCENT_BASE,
  );

  return { payableMinor, discountMinor: originalMinor - payableMinor };
};
