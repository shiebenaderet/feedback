// src/auth/useAuth.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// --- Mock firebase/auth: capture the onAuthStateChanged callback ---
// vi.mock is hoisted above declarations, so the mocks + the shared callback
// holder must live in vi.hoisted(). `holder.cb` is the captured callback the
// tests fire; using a holder object keeps a single shared reference.
const { onAuthStateChanged, signOut, holder } = vi.hoisted(() => {
  const holder: { cb: ((user: unknown) => void) | null } = { cb: null };
  return {
    holder,
    onAuthStateChanged: vi.fn((_auth, cb: (u: unknown) => void) => {
      holder.cb = cb;
      return () => {}; // unsubscribe
    }),
    signOut: vi.fn(() => Promise.resolve()),
  };
});
const authCallback = () => holder.cb;

vi.mock('firebase/auth', () => ({ onAuthStateChanged, signOut }));
vi.mock('../firebase/config', () => ({ auth: { kind: 'auth' } }));

// allowlist contains only the teacher
vi.mock('./allowlist', () => ({
  parseAllowlist: () => ['teacher@example.com'],
  isEmailAllowed: (email: string | null | undefined, list: string[]) =>
    !!email && list.includes(email.toLowerCase()),
}));

import { AuthProvider, useAuth } from './useAuth';

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.cb = null;
  });

  it('starts in the loading state before Firebase reports', () => {
    renderProbe();
    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('is signed-out when Firebase reports no user', () => {
    renderProbe();
    act(() => authCallback()!(null));
    expect(screen.getByTestId('status').textContent).toBe('signedOut');
    expect(screen.getByTestId('email').textContent).toBe('none');
  });

  it('is signed-in for an allowlisted user', () => {
    renderProbe();
    act(() => authCallback()!({ email: 'teacher@example.com', uid: 'u1' }));
    expect(screen.getByTestId('status').textContent).toBe('signedIn');
    expect(screen.getByTestId('email').textContent).toBe('teacher@example.com');
  });

  it('signs out and reports signedOut for a non-allowlisted user', () => {
    renderProbe();
    act(() => authCallback()!({ email: 'stranger@example.com', uid: 'u2' }));
    expect(signOut).toHaveBeenCalledWith({ kind: 'auth' });
    expect(screen.getByTestId('status').textContent).toBe('signedOut');
    expect(screen.getByTestId('email').textContent).toBe('none');
  });
});
