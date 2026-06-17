import { describe, it, expect } from 'vitest';
import { periodFeedbackProgress } from './periodFeedbackProgress';
import type { FeedbackHistoryEntry } from '../types';
import type { GradingPeriod } from './taxonomy';

function entry(studentId: string, gradingPeriod: GradingPeriod): FeedbackHistoryEntry {
  return {
    studentId,
    periodId: 'p1',
    courseId: 'c1',
    yearId: 'y1',
    sentAt: 1,
    gradingPeriod,
    finalText: 'x',
    tags: { areas: [], sentiments: [], standards: [] },
    usedEntries: [],
  };
}

describe('periodFeedbackProgress', () => {
  it('counts distinct students with history in the given grading period', () => {
    const history: FeedbackHistoryEntry[] = [
      entry('s1', 'Q1'),
      entry('s1', 'Q1'), // duplicate student — counts once
      entry('s2', 'Q1'),
      entry('s3', 'Q2'), // different grading period — not counted for Q1
    ];
    expect(periodFeedbackProgress(3, history, 'Q1')).toEqual({ done: 2, total: 3 });
  });

  it('is zero-safe with no history', () => {
    expect(periodFeedbackProgress(0, [], 'Q1')).toEqual({ done: 0, total: 0 });
  });

  it('clamps done to total when history exceeds roster (re-sends, removed students)', () => {
    const history = [entry('s1', 'Q1'), entry('s2', 'Q1'), entry('ghost', 'Q1')];
    expect(periodFeedbackProgress(2, history, 'Q1')).toEqual({ done: 2, total: 2 });
  });
});
