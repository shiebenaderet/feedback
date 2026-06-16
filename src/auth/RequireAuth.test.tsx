// src/auth/RequireAuth.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Control what useAuth returns per test.
// AuthState shape (from useAuth): { status: 'loading'|'signedIn'|'signedOut', user: User|null }
const useAuthMock = vi.fn();
vi.mock('./useAuth', () => ({ useAuth: () => useAuthMock() }));

import RequireAuth from './RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>Landing</div>} />
        <Route
          path="/compose"
          element={
            <RequireAuth>
              <div>Protected Compose</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('renders a loading placeholder while auth resolves', () => {
    useAuthMock.mockReturnValue({ status: 'loading', user: null });
    renderAt('/compose');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Compose')).not.toBeInTheDocument();
  });

  it('redirects a signed-out user (deep link) to the landing page', () => {
    useAuthMock.mockReturnValue({ status: 'signedOut', user: null });
    renderAt('/compose');
    expect(screen.getByText('Landing')).toBeInTheDocument();
    expect(screen.queryByText('Protected Compose')).not.toBeInTheDocument();
  });

  it('renders the protected children for a signed-in user', () => {
    useAuthMock.mockReturnValue({
      status: 'signedIn',
      user: { email: 'teacher@example.com' },
    });
    renderAt('/compose');
    expect(screen.getByText('Protected Compose')).toBeInTheDocument();
  });
});
