// src/roster/rosterTemplate.test.ts
import { describe, it, expect } from 'vitest';
import { buildRosterTemplateCsv } from './rosterTemplate';
import { parseRoster } from './parseRoster';

describe('buildRosterTemplateCsv', () => {
  it('returns a name,email CSV with a header row and one example row', () => {
    const csv = buildRosterTemplateCsv();
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('name,email');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Ada Lovelace,ada.lovelace@school.edu');
  });

  it('round-trips through parseRoster: the example row imports cleanly', () => {
    const result = parseRoster(buildRosterTemplateCsv());
    expect(result.columnMapping.name).toBe('name');
    expect(result.columnMapping.email).toBe('email');
    expect(result.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada.lovelace@school.edu', period: '', sourceRow: 2 },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('ends with a trailing newline so editors append rows on a fresh line', () => {
    expect(buildRosterTemplateCsv().endsWith('\n')).toBe(true);
  });
});
