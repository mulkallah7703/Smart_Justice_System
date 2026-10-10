import { createHash } from 'node:crypto';

/**
 * DEVELOPMENT/TEST ONLY. These markers let a test drive a reproducible failure
 * through the real queue and worker path without any external dependency.
 *
 * They are recognised only by the mock adapters, and configuration refuses to
 * select mock adapters under NODE_ENV=production, so no directive is reachable
 * in production.
 */
export const MOCK_FAIL_ALWAYS = 'mock-fail-always';
export const MOCK_FAIL_ONCE = 'mock-fail-once';

const attemptCounters = new Map<string, number>();

/** Clears the per-process counters so each test starts from a known state. */
export const resetMockDirectives = (): void => {
  attemptCounters.clear();
};

const findMarker = (values: readonly string[]): string | null => {
  for (const value of values) {
    if (value.includes(MOCK_FAIL_ALWAYS)) {
      return MOCK_FAIL_ALWAYS;
    }
    if (value.includes(MOCK_FAIL_ONCE)) {
      return MOCK_FAIL_ONCE;
    }
  }
  return null;
};

/**
 * Returns true when this call should fail. `MOCK_FAIL_ONCE` fails only its
 * first call for a given scope, so a retry succeeds and the test can assert
 * both the retry and the final status.
 */
export const shouldMockFail = (
  scope: string,
  values: readonly string[],
): boolean => {
  const marker = findMarker(values);
  if (!marker) {
    return false;
  }
  if (marker === MOCK_FAIL_ALWAYS) {
    return true;
  }

  const key = `${scope}:${marker}`;
  const seen = attemptCounters.get(key) ?? 0;
  attemptCounters.set(key, seen + 1);
  return seen === 0;
};

/** Stable 64-hex digest used to make every mock output reproducible. */
export const mockDigest = (...parts: readonly string[]): string =>
  createHash('sha256').update(parts.join('\u0000')).digest('hex');
