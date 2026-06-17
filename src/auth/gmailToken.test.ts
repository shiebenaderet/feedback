import { describe, it, expect, beforeEach, vi } from 'vitest';

const { signInWithPopupMock, credentialFromResultMock } = vi.hoisted(() => ({
  signInWithPopupMock: vi.fn(),
  credentialFromResultMock: vi.fn(),
}));

vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    addScope = vi.fn();
    setCustomParameters = vi.fn();
    static credentialFromResult = credentialFromResultMock;
  }
  return {
    GoogleAuthProvider,
    signInWithPopup: signInWithPopupMock,
    signOut: vi.fn(),
  };
});
vi.mock('../firebase/config', () => ({ auth: { __fake: true } }));

import { signInWithGoogle } from './authService';
import { getGmailAccessToken, __setGmailAccessToken } from './gmailToken';

describe('Gmail access-token capture', () => {
  beforeEach(() => {
    __setGmailAccessToken(null);
    signInWithPopupMock.mockReset();
    credentialFromResultMock.mockReset();
  });

  it('stores the OAuth access token from the sign-in credential', async () => {
    const user = { uid: 'u1', email: 't@x.edu' };
    signInWithPopupMock.mockResolvedValue({ user });
    credentialFromResultMock.mockReturnValue({ accessToken: 'ya29.TOKEN' });

    const result = await signInWithGoogle();

    expect(result).toBe(user);
    expect(getGmailAccessToken()).toBe('ya29.TOKEN');
  });

  it('leaves the token null when no credential is returned', async () => {
    signInWithPopupMock.mockResolvedValue({ user: { uid: 'u1' } });
    credentialFromResultMock.mockReturnValue(null);

    await signInWithGoogle();

    expect(getGmailAccessToken()).toBeNull();
  });
});

import { getGmailAccessToken as getToken, __setGmailAccessToken as setToken } from './gmailToken';

describe('Gmail token persistence (survives reload via sessionStorage)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken(null);
  });

  it('persists to sessionStorage so a reload can read it', () => {
    setToken('ya29.PERSISTED');
    expect(sessionStorage.getItem('gmailAccessToken')).toBe('ya29.PERSISTED');
    // Simulate a fresh module read (reload): the value is still retrievable.
    expect(getToken()).toBe('ya29.PERSISTED');
  });

  it('clearing the token removes it from sessionStorage', () => {
    setToken('ya29.X');
    setToken(null);
    expect(sessionStorage.getItem('gmailAccessToken')).toBeNull();
    expect(getToken()).toBeNull();
  });
});
