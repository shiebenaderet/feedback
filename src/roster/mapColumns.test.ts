// src/roster/mapColumns.test.ts
import { describe, it, expect } from 'vitest';
import { mapColumns } from './mapColumns';

describe('mapColumns', () => {
  it('maps canonical headers case/space-insensitively', () => {
    expect(mapColumns(['Name', 'Email', 'Period'])).toEqual({
      name: 'Name', email: 'Email', period: 'Period',
    });
  });

  it('recognizes common synonyms and odd column order', () => {
    expect(mapColumns(['Student E-Mail', 'Class', 'Full Name'])).toEqual({
      name: 'Full Name', email: 'Student E-Mail', period: 'Class',
    });
  });

  it('returns null for fields whose column is absent', () => {
    expect(mapColumns(['Name', 'Email'])).toEqual({
      name: 'Name', email: 'Email', period: null,
    });
  });

  it('does not match an unrelated extra column', () => {
    const m = mapColumns(['Name', 'Email', 'GPA']);
    expect(m.period).toBeNull();
  });

  it('takes the first matching header when synonyms repeat', () => {
    expect(mapColumns(['email', 'Email Address']).email).toBe('email');
  });
});
