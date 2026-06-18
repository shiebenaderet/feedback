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

// Stub the heavy compose/review pages so route tests assert ROUTING only.
vi.mock('./pages/ComposePage', () => ({ ComposePage: () => <div>compose-page</div> }));
vi.mock('./pages/ReviewSendPage', () => ({ ReviewSendPage: () => <div>review-page</div> }));
vi.mock('./pages/SetupPage', () => ({ SetupPage: () => <div>setup-page</div> }));

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
  it('shows the landing page at "/" when signed out', async () => {
    renderAt('/', { status: 'signedOut', user: null });
    // Routes are lazy-loaded, so the content resolves asynchronously.
    expect(
      await screen.findByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
  });

  it('bounces a signed-out deep link to "/home" back to the landing page', async () => {
    renderAt('/home', { status: 'signedOut', user: null });
    expect(
      await screen.findByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });

  it('shows the protected home page for a signed-in teacher', async () => {
    renderAt('/home', {
      status: 'signedIn',
      user: { email: 'teacher@example.com' },
    });
    expect(
      // Real (un-mocked) HomePage is lazy-loaded; give the chunk transform headroom.
      await screen.findByText(/signed in as teacher@example.com/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});

describe('protected compose/review routes', () => {
  it('renders ComposePage at /compose/:courseId/:periodId when signed in', async () => {
    useAuthMock.mockReturnValue({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } });
    render(
      <MemoryRouter initialEntries={['/course/c1/period/p1/compose']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText('compose-page')).toBeInTheDocument();
  });

  it('renders ReviewSendPage at /review/:batchId when signed in', async () => {
    useAuthMock.mockReturnValue({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } });
    render(
      <MemoryRouter initialEntries={['/review/b1']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText('review-page')).toBeInTheDocument();
  });
});

describe('setup route', () => {
  it('renders SetupPage at /setup when signed in', async () => {
    useAuthMock.mockReturnValue({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } });
    render(
      <MemoryRouter initialEntries={['/setup']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText('setup-page')).toBeInTheDocument();
  });
});

