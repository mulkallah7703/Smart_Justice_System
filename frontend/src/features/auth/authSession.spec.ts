import { describe, expect, it } from 'vitest';

import { authStore } from './authStore';

describe('auth session', () => {
  it('clears the JWT on logout', () => {
    authStore.getState().setTokens('session-token');
    expect(authStore.getState().accessToken).toBe('session-token');
    authStore.getState().clearAuth();
    expect(authStore.getState().accessToken).toBeNull();
  });
});
