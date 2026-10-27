type HeaderValue = number | string | readonly string[];

export interface CookieResponse {
  setHeader(name: string, value: HeaderValue): unknown;
}

/**
 * Cross-site browsers (vercel.app calling onrender.com) store a cookie only
 * when it is `SameSite=None; Secure`. Partitioned is left off.
 */
export const withCrossSiteCookieAttributes = (header: string): string => {
  const parts = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const nameValue = parts[0] ?? header;
  const rest = parts.slice(1).filter((part) => {
    const key = part.split('=')[0]?.trim().toLowerCase();
    return key !== 'samesite' && key !== 'secure' && key !== 'partitioned';
  });
  return [nameValue, ...rest, 'SameSite=None', 'Secure'].join('; ');
};

/** Production-only. Development keeps default cookie attributes. */
export const crossSiteCookieMiddleware = (
  _req: unknown,
  res: CookieResponse,
  next: () => void,
): void => {
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name: string, value: HeaderValue) => {
    if (name.toLowerCase() !== 'set-cookie') {
      return setHeader(name, value);
    }
    if (typeof value === 'string') {
      return setHeader(name, withCrossSiteCookieAttributes(value));
    }
    if (Array.isArray(value)) {
      return setHeader(
        name,
        value.map((item) => withCrossSiteCookieAttributes(String(item))),
      );
    }
    return setHeader(name, value);
  };
  next();
};
