import { assertDevelopmentSeed } from '../src/shared/seed/assert-development-seed';

describe('demo seed guard', () => {
  it('allows development and test', () => {
    expect(() =>
      assertDevelopmentSeed({ NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => assertDevelopmentSeed({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('refuses production, staging, and an unset environment', () => {
    expect(() => assertDevelopmentSeed({ NODE_ENV: 'production' })).toThrow(
      /NODE_ENV=production/,
    );
    expect(() => assertDevelopmentSeed({ NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV=staging/,
    );
    expect(() => assertDevelopmentSeed({})).toThrow(/NODE_ENV=\(unset\)/);
  });
});
