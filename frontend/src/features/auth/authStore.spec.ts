import { describe, expect, it } from 'vitest';

import { authStore } from './authStore';

describe('authStore', () => {
  it('stores and clears the access token', () => {
    authStore.getState().clearAuth();
    expect(authStore.getState().accessToken).toBeNull();

    authStore.getState().setTokens('stored-token');
    expect(authStore.getState().accessToken).toBe('stored-token');
    expect(window.localStorage.getItem('auth')).toContain('stored-token');

    authStore.getState().clearAuth();
    expect(authStore.getState().accessToken).toBeNull();
    expect(window.localStorage.getItem('auth')).not.toContain('stored-token');
  });
});
