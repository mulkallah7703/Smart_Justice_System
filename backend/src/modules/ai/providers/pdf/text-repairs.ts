/**
 * Repairs two text-layer defects without reordering words or converting digits.
 *
 * - Lam-alef ligatures often arrive as alef + hamza-alef + lam (`األول`)
 *   instead of alef + lam + hamza-alef (`الأول`).
 * - Digits glued to letters (`بتاريخ1يناير2026`) are split with a space.
 *   Arabic-Indic digits stay Arabic-Indic.
 */

const BROKEN_LAM_ALEF = /ا([أإآا])ل/g;

export const repairLamAlef = (value: string): string =>
  value.replace(BROKEN_LAM_ALEF, 'ال$1');

export const separateGluedDigits = (value: string): string =>
  value
    .replace(/([\p{L}])([\p{N}])/gu, '$1 $2')
    .replace(/([\p{N}])([\p{L}])/gu, '$1 $2');
