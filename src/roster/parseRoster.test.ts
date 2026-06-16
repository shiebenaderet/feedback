// src/roster/parseRoster.test.ts
import { describe, it, expect } from 'vitest';
import { parseRoster } from './parseRoster';

describe('parseRoster', () => {
  it('parses a clean CSV and reports the column mapping', () => {
    const csv = 'Name,Email,Period\nAda Lovelace,ada@x.edu,3\nAlan Turing,alan@x.edu,3\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '3', sourceRow: 2 },
      { name: 'Alan Turing', email: 'alan@x.edu', period: '3', sourceRow: 3 },
    ]);
    expect(r.columnMapping).toEqual({ name: 'Name', email: 'Email', period: 'Period' });
    expect(r.skipped).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it('skips rows with a blank email, not silently', () => {
    const csv = 'Name,Email\nAda Lovelace,ada@x.edu\nNo Email,   \n';
    const r = parseRoster(csv);
    expect(r.students.map((s) => s.email)).toEqual(['ada@x.edu']);
    expect(r.skipped).toEqual([
      { sourceRow: 3, reason: 'Missing email', raw: { Name: 'No Email', Email: '   ' } },
    ]);
  });

  it('skips rows with an invalid email format', () => {
    const csv = 'Name,Email\nBad Addr,not-an-email\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([]);
    expect(r.skipped[0].reason).toBe('Invalid email format');
  });

  it('normalizes "Last, First" names via quoted CSV fields', () => {
    const csv = 'Name,Email\n"Lovelace, Ada",ada@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students[0].name).toBe('Ada Lovelace');
  });

  it('detects duplicate emails case-insensitively, keeping the first', () => {
    const csv = 'Name,Email\nAda,ada@x.edu\nAda Again,ADA@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students.map((s) => s.email)).toEqual(['ada@x.edu']);
    expect(r.duplicates).toEqual([{ email: 'ada@x.edu', sourceRows: [2, 3] }]);
    expect(r.skipped).toContainEqual(
      expect.objectContaining({ sourceRow: 3, reason: 'Duplicate email' }),
    );
  });

  it('ignores extra/over columns and fills period with "" when absent', () => {
    const csv = 'Full Name,GPA,Student E-Mail\nAda Lovelace,4.0,ada@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students[0]).toEqual({ name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 });
    expect(r.columnMapping.period).toBeNull();
  });

  it('skips a row missing the name column value', () => {
    const csv = 'Name,Email\n,ada@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([]);
    expect(r.skipped[0].reason).toBe('Missing name');
  });

  it('errors out cleanly when no email column can be found', () => {
    const csv = 'Name,Phone\nAda,555\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([]);
    expect(r.skipped[0].reason).toBe('No email column found in file');
  });
});
