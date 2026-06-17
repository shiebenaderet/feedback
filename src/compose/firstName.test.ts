import { describe, it, expect } from 'vitest';
import { firstName } from './firstName';

describe('firstName', () => {
  it('drops a trailing single-letter initial (with or without a period)', () => {
    expect(firstName('Aneth G.')).toBe('Aneth');
    expect(firstName('Wednesday B')).toBe('Wednesday');
    expect(firstName('Bryan M.')).toBe('Bryan');
  });

  it('leaves a lone first name untouched', () => {
    expect(firstName('Ellie')).toBe('Ellie');
  });

  it('keeps a real multi-word first name, dropping only the trailing initial', () => {
    expect(firstName('Mary Jane S.')).toBe('Mary Jane');
    expect(firstName('Anna Lee')).toBe('Anna Lee');
  });

  it('does not strip a trailing word that is a full surname (not an initial)', () => {
    expect(firstName('Lena Larson')).toBe('Lena Larson');
  });

  it('trims surrounding whitespace and handles empty input', () => {
    expect(firstName('  Aneth G.  ')).toBe('Aneth');
    expect(firstName('')).toBe('');
  });
});
