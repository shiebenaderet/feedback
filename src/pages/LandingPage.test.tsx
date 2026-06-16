// src/pages/LandingPage.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Mock the auth service so the button has something to call.
// vi.hoisted so the mock fn exists when the hoisted factory runs.
const { signInWithGoogle, useAuthMock } = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(() => Promise.resolve({ email: 't@x.com' })),
  useAuthMock: vi.fn<[], { status: string; user: { email: string } | null }>(() => ({
    status: 'signedOut',
    user: null,
  })),
}));
vi.mock('../auth/authService', () => ({ signInWithGoogle }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => useAuthMock() }));

import LandingPage from './LandingPage';

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ status: 'signedOut', user: null });
  });

  it('redirects a signed-in user to /home', () => {
    useAuthMock.mockReturnValue({
      status: 'signedIn',
      user: { email: 'benaderets885@edmonds.wednet.edu' },
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /sign in with google/i }),
    ).not.toBeInTheDocument();
  });

  it('describes the tool to an unauthenticated visitor', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: /student feedback emails/i }),
    ).toBeInTheDocument();
  });

  it('renders exactly one Sign in with Google button', () => {
    render(<LandingPage />);
    const buttons = screen.getAllByRole('button', {
      name: /sign in with google/i,
    });
    expect(buttons).toHaveLength(1);
  });

  it('calls signInWithGoogle when the button is clicked', async () => {
    render(<LandingPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows an error message if sign-in is rejected', async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error('popup closed'));
    render(<LandingPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/sign.?in failed/i);
  });
});
