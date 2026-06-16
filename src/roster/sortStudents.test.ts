// src/roster/sortStudents.test.ts
import { describe, it, expect } from 'vitest';
import { sortStudentsByName } from './sortStudents';

// Minimal student shape this helper needs: { name: string }
describe('sortStudentsByName', () => {
  it('sorts ascending by name, case-insensitively', () => {
    const out = sortStudentsByName(
      [{ name: 'alan turing' }, { name: 'Ada Lovelace' }, { name: 'Brian K' }],
      'asc',
    );
    expect(out.map((s) => s.name)).toEqual(['Ada Lovelace', 'alan turing', 'Brian K']);
  });

  it('sorts descending when asked', () => {
    const out = sortStudentsByName(
      [{ name: 'Ada' }, { name: 'Zed' }, { name: 'Max' }],
      'desc',
    );
    expect(out.map((s) => s.name)).toEqual(['Zed', 'Max', 'Ada']);
  });

  it('does not mutate the input array', () => {
    const input = [{ name: 'B' }, { name: 'A' }];
    const out = sortStudentsByName(input, 'asc');
    expect(input.map((s) => s.name)).toEqual(['B', 'A']);
    expect(out.map((s) => s.name)).toEqual(['A', 'B']);
  });
});
