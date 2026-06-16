// src/App.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// AuthState shape (from useAuth): { status: 'loading'|'signedIn'|'signedOut', user: User|null }
const useAuthMock = vi.fn();
vi.mock('./auth/useAuth', () => ({ useAuth: () => useAuthMock() }));

// Landing button calls into authService; stub it so no real Firebase is touched.
vi.mock('./auth/authService', () => ({
  signInWithGoogle: vi.fn(() => Promise.resolve({ email: 't@x.com' })),
  signOutTeacher: vi.fn(() => Promise.resolve()),
}));

// The /roster route transitively imports firebase/config (which calls getAuth at
// load); stub it so the route table can be rendered without a real Firebase app.
vi.mock('./firebase/config', () => ({ db: { __fake: true }, auth: { __fake: true } }));

import { AppRoutes } from './App';

function renderAt(path: string, auth: { status: string; user: unknown }) {
  useAuthMock.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('shows the landing page at "/" when signed out', () => {
    renderAt('/', { status: 'signedOut', user: null });
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
  });

  it('bounces a signed-out deep link to "/home" back to the landing page', () => {
    renderAt('/home', { status: 'signedOut', user: null });
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });

  it('shows the protected home page for a signed-in teacher', () => {
    renderAt('/home', {
      status: 'signedIn',
      user: { email: 'teacher@example.com' },
    });
    expect(screen.getByText(/signed in as teacher@example.com/i)).toBeInTheDocument();
  });
});
