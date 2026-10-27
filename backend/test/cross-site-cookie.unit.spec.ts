import {
  crossSiteCookieMiddleware,
  withCrossSiteCookieAttributes,
} from '../src/shared/http/cross-site-cookie';

describe('withCrossSiteCookieAttributes', () => {
  it('sets SameSite=None and Secure without Partitioned', () => {
    expect(
      withCrossSiteCookieAttributes('session=abc; Path=/; HttpOnly; SameSite=Lax'),
    ).toBe('session=abc; Path=/; HttpOnly; SameSite=None; Secure');
  });

  it('does not duplicate Secure', () => {
    expect(withCrossSiteCookieAttributes('id=1; Secure; SameSite=None')).toBe(
      'id=1; SameSite=None; Secure',
    );
  });
});

describe('crossSiteCookieMiddleware', () => {
  it('rewrites only Set-Cookie', () => {
    const headers = new Map<string, unknown>();
    const res = {
      setHeader(name: string, value: number | string | readonly string[]) {
        headers.set(name, value);
        return this;
      },
    };
    const next = jest.fn();
    crossSiteCookieMiddleware({}, res, next);
    res.setHeader('X-Test', 'ok');
    res.setHeader('Set-Cookie', 'session=abc; SameSite=Lax');
    expect(headers.get('X-Test')).toBe('ok');
    expect(headers.get('Set-Cookie')).toBe('session=abc; SameSite=None; Secure');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
