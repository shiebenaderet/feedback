// src/roster/types.test.ts
import { describe, it, expect } from 'vitest';
import { EMPTY_PARSE_RESULT, type ParsedStudent, type ParseResult } from './types';

describe('roster types', () => {
  it('EMPTY_PARSE_RESULT is a usable zero-value ParseResult', () => {
    const r: ParseResult = EMPTY_PARSE_RESULT;
    expect(r.students).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.duplicates).toEqual([]);
    expect(r.columnMapping).toEqual({ name: null, email: null, period: null });
  });

  it('a ParsedStudent carries normalized fields', () => {
    const s: ParsedStudent = { name: 'Ada Lovelace', email: 'ada@x.edu', period: '3', sourceRow: 2 };
    expect(s.name).toBe('Ada Lovelace');
    expect(s.sourceRow).toBe(2);
  });
});
