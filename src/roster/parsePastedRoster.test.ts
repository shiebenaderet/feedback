// src/roster/parsePastedRoster.test.ts
import { describe, it, expect } from 'vitest';
import { parsePastedRoster } from './parsePastedRoster';

describe('parsePastedRoster', () => {
  it('parses "Name, email" lines into students (delegating to parseRoster)', () => {
    const text = 'Ada Lovelace, ada@x.edu\nAlan Turing, alan@x.edu\n';
    const r = parsePastedRoster(text);
    expect(r.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 },
      { name: 'Alan Turing', email: 'alan@x.edu', period: '', sourceRow: 3 },
    ]);
    expect(r.skipped).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it('accepts tab-separated and multi-space-separated lines too', () => {
    const text = 'Ada Lovelace\tada@x.edu\nAlan Turing   alan@x.edu';
    const r = parsePastedRoster(text);
    expect(r.students.map((s) => s.email)).toEqual(['ada@x.edu', 'alan@x.edu']);
  });

  it('ignores blank lines and trims surrounding whitespace', () => {
    const text = '\n  Ada Lovelace, ada@x.edu  \n\n';
    const r = parsePastedRoster(text);
    expect(r.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 },
    ]);
  });

  it('surfaces a bad line as a skipped row (reusing parseRoster validation)', () => {
    const text = 'Ada Lovelace, ada@x.edu\nNo Email Here,';
    const r = parsePastedRoster(text);
    expect(r.students.map((s) => s.name)).toEqual(['Ada Lovelace']);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe('Missing email');
  });

  it('returns an all-empty result for blank input', () => {
    const r = parsePastedRoster('   \n  ');
    expect(r.students).toEqual([]);
    expect(r.skipped).toEqual([]);
  });
});
