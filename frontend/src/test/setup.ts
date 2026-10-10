import { beforeEach, vi } from 'vitest';

/**
 * Default unit-test mode: explicit mock APIs.
 * Live/API specs override with VITE_API_MODE=real and a base URL.
 */
beforeEach(() => {
  vi.stubEnv('VITE_API_MODE', 'mock');
  vi.stubEnv('VITE_API_BASE_URL', '');
});
