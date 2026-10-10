import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { authStore } from '../../features/auth/authStore';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Redirects unauthenticated users to /login. Public auth routes stay outside.
 */
export const RequireAuth = ({ children }: RequireAuthProps): JSX.Element => {
  const accessToken = authStore((state) => state.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/** Sends already-authenticated users away from login/register. */
export const PublicOnly = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const accessToken = authStore((state) => state.accessToken);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
