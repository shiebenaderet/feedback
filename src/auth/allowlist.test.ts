// src/auth/allowlist.test.ts
import { describe, it, expect } from 'vitest';
import { isEmailAllowed, parseAllowlist } from './allowlist';

describe('parseAllowlist', () => {
  it('splits a comma-separated env string, trims, lowercases, drops blanks', () => {
    expect(parseAllowlist(' Teacher@Example.com , extra@x.com ,')).toEqual([
      'teacher@example.com',
      'extra@x.com',
    ]);
  });

  it('returns an empty list for undefined or empty input', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
  });
});

describe('isEmailAllowed', () => {
  const allow = ['teacher@example.com'];

  it('allows an exact match regardless of case/whitespace', () => {
    expect(isEmailAllowed('  TEACHER@example.com ', allow)).toBe(true);
  });

  it('rejects a non-listed email', () => {
    expect(isEmailAllowed('stranger@example.com', allow)).toBe(false);
  });

  it('rejects null/empty email', () => {
    expect(isEmailAllowed(null, allow)).toBe(false);
    expect(isEmailAllowed('', allow)).toBe(false);
  });

  it('rejects everything when the allowlist is empty', () => {
    expect(isEmailAllowed('teacher@example.com', [])).toBe(false);
  });
});
