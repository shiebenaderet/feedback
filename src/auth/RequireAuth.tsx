import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Wrap any protected route. While auth is resolving, show a placeholder.
 * A signed-out visitor (including deep links) is redirected to the landing
 * page at "/". A signed-in teacher sees the protected children.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <p>Loading…</p>;
  }

  if (status === 'signedOut') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
