import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthState } from './auth.types';

export const authStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      setTokens: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ accessToken: null }),
    }),
    { name: 'auth' },
  ),
);
