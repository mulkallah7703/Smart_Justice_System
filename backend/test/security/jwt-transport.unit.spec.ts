/**
 * Phase V.1 — JWT storage decision lock.
 * Cookie migration is deferred; Bearer-in-Authorization remains the contract.
 */

import { ExtractJwt } from 'passport-jwt';

describe('Phase V.1 security — JWT transport decision', () => {
  it('documents Bearer-from-header extraction (no cookie extractor)', () => {
    const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
    const withBearer = {
      headers: { authorization: 'Bearer unit-test-token' },
    } as never;
    const withCookieOnly = {
      headers: { cookie: 'accessToken=unit-test-token' },
    } as never;

    expect(extractor(withBearer)).toBe('unit-test-token');
    expect(extractor(withCookieOnly)).toBeNull();
  });
});
