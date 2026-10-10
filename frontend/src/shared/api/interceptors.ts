import { authStore } from '../../features/auth/authStore';

const LOGIN_PATH = '/login';

export const handleUnauthorized = (): void => {
  authStore.getState().clearAuth();

  if (typeof window === 'undefined') {
    return;
  }

  const path = window.location.pathname;
  if (
    path === LOGIN_PATH ||
    path === '/register' ||
    path === '/onboarding' ||
    path === '/splash'
  ) {
    return;
  }

  window.location.assign(LOGIN_PATH);
};
