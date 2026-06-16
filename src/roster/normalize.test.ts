// src/roster/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeName, normalizeEmail } from './normalize';

describe('normalizeName', () => {
  it('flips "Last, First" into "First Last"', () => {
    expect(normalizeName('Lovelace, Ada')).toBe('Ada Lovelace');
  });

  it('handles "Last, First Middle"', () => {
    expect(normalizeName('Curie, Marie Sklodowska')).toBe('Marie Sklodowska Curie');
  });

  it('leaves an already "First Last" name untouched', () => {
    expect(normalizeName('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('collapses internal/edge whitespace', () => {
    expect(normalizeName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });

  it('ignores a trailing comma with no second part', () => {
    expect(normalizeName('Lovelace,')).toBe('Lovelace');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ada@X.EDU ')).toBe('ada@x.edu');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeEmail('   ')).toBe('');
  });
});
