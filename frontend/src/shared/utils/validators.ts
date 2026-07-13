export const sanitizeNationalId = (value: string): string =>
  value.replace(/\D/g, '').slice(0, 10);

export const formatNationalId = (value: string): string => {
  const digits = sanitizeNationalId(value);

  if (!digits) {
    return '';
  }

  return digits.match(/.{1,2}/g)?.join(' ') ?? digits;
};

export const isValidNationalId = (value: string): boolean =>
  /^[12]\d{9}$/.test(sanitizeNationalId(value));
