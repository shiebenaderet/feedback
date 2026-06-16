// src/compose/rosterProgress.test.ts
import { describe, it, expect } from 'vitest';
import { rosterProgress } from './rosterProgress';

// Shapes restated from the data model (spec):
// Student: { id: string; name: string }
// Message: { studentId: string; finalText: string; status: 'draft'|'sent'|'failed' }

const students = [
  { id: 's1', name: 'Ana' },
  { id: 's2', name: 'Ben' },
  { id: 's3', name: 'Cy' },
];

describe('rosterProgress', () => {
  it('counts a student done when a message has non-empty finalText', () => {
    const messages = [{ studentId: 's1', finalText: 'Hi Ana', status: 'draft' as const }];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(1);
    expect(result.total).toBe(3);
    expect(result.doneIds).toEqual(new Set(['s1']));
  });

  it('does not count an empty or whitespace-only draft as done', () => {
    const messages = [
      { studentId: 's1', finalText: '', status: 'draft' as const },
      { studentId: 's2', finalText: '   ', status: 'draft' as const },
    ];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(0);
    expect(result.doneIds.size).toBe(0);
  });

  it('counts every student with content regardless of status', () => {
    const messages = [
      { studentId: 's1', finalText: 'a', status: 'sent' as const },
      { studentId: 's2', finalText: 'b', status: 'failed' as const },
      { studentId: 's3', finalText: 'c', status: 'draft' as const },
    ];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(3);
    expect(result.doneIds).toEqual(new Set(['s1', 's2', 's3']));
  });

  it('ignores messages for unknown students', () => {
    const messages = [{ studentId: 'ghost', finalText: 'x', status: 'draft' as const }];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(0);
  });
});
