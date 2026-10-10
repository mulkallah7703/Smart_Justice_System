import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthState } from './auth.types';

/**
 * Access token is persisted in localStorage under the key `auth`.
 * This matches the existing Zustand persist architecture and restores
 * the session on refresh. localStorage is readable to any script on this
 * origin (XSS tradeoff). Refresh-token cookies are a later hardening phase.
 */
export const authStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      setTokens: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ accessToken: null }),
    }),
    {
      name: 'auth',
      partialize: (state) => ({ accessToken: state.accessToken }),
    },
  ),
);
