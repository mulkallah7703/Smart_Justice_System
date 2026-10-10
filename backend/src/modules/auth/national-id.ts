export const NATIONAL_ID_PATTERN = /^[12]\d{9}$/;

export const isValidNationalId = (value: string): boolean =>
  NATIONAL_ID_PATTERN.test(value);
