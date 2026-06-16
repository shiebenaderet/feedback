// src/send/isAuthError.test.ts
import { describe, it, expect } from 'vitest';
import { isAuthError } from './isAuthError';

describe('isAuthError', () => {
  it('classifies HTTP 401 as an auth error', () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it('classifies a gapi-style 401 (error.code) as an auth error', () => {
    expect(isAuthError({ error: { code: 401, message: 'Invalid Credentials' } })).toBe(true);
  });

  it('classifies an invalid-credentials / invalid_token reason as an auth error', () => {
    expect(isAuthError({ status: 403, message: 'invalid_grant: token expired' })).toBe(true);
    expect(isAuthError({ result: { error: { status: 'UNAUTHENTICATED' } } })).toBe(true);
  });

  it('does NOT classify a per-message failure (bad recipient / 400 / 500) as an auth error', () => {
    expect(isAuthError({ status: 400, message: 'Invalid To header' })).toBe(false);
    expect(isAuthError({ status: 500 })).toBe(false);
    expect(isAuthError(new Error('network timeout'))).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
