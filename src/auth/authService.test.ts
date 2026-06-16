// src/auth/authService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock firebase/auth ---
// vi.mock is hoisted above const declarations, so the mock vars must be created
// inside vi.hoisted() to exist when the factory runs (avoids "Cannot access
// 'signInWithPopup' before initialization").
const { signInWithPopup, signOut, FakeGoogleProvider } = vi.hoisted(() => {
  class FakeGoogleProvider {
    scopes: string[] = [];
    params: Record<string, string> = {};
    addScope(s: string) {
      this.scopes.push(s);
    }
    setCustomParameters(p: Record<string, string>) {
      this.params = p;
    }
  }
  return { signInWithPopup: vi.fn(), signOut: vi.fn(), FakeGoogleProvider };
});

vi.mock('firebase/auth', () => ({
  signInWithPopup,
  signOut,
  GoogleAuthProvider: FakeGoogleProvider,
}));

// --- Mock our firebase config so importing authService doesn't init real Firebase ---
vi.mock('../firebase/config', () => ({ auth: { kind: 'auth' } }));

import {
  GMAIL_SEND_SCOPE,
  signInWithGoogle,
  signOutTeacher,
} from './authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the Gmail-send scope on the provider', async () => {
    signInWithPopup.mockResolvedValue({ user: { email: 't@x.com' } });
    await signInWithGoogle();

    const provider = signInWithPopup.mock.calls[0][1] as InstanceType<
      typeof FakeGoogleProvider
    >;
    expect(provider.scopes).toContain(GMAIL_SEND_SCOPE);
    expect(GMAIL_SEND_SCOPE).toBe(
      'https://www.googleapis.com/auth/gmail.send',
    );
  });

  it('passes the configured auth instance to signInWithPopup', async () => {
    signInWithPopup.mockResolvedValue({ user: { email: 't@x.com' } });
    await signInWithGoogle();
    expect(signInWithPopup.mock.calls[0][0]).toEqual({ kind: 'auth' });
  });

  it('returns the signed-in user', async () => {
    const user = { email: 't@x.com', uid: 'u1' };
    signInWithPopup.mockResolvedValue({ user });
    await expect(signInWithGoogle()).resolves.toEqual(user);
  });

  it('delegates sign-out to firebase signOut with the auth instance', async () => {
    signOut.mockResolvedValue(undefined);
    await signOutTeacher();
    expect(signOut).toHaveBeenCalledWith({ kind: 'auth' });
  });
});
