import { describe, it, expect } from 'vitest';
import type { Batch } from './types';
import type { GradingPeriod } from './feedback/taxonomy';

describe('Batch carries the full tree + grading-period', () => {
  it('has yearId/courseId/periodId, sharedHeader, status', () => {
    const b: Batch = {
      id: 'b1', yearId: 'y1', courseId: 'c1', periodId: 'p1',
      sharedHeader: 'EOY', status: 'draft',
    };
    expect(Object.keys(b)).toEqual(
      expect.arrayContaining(['id', 'yearId', 'courseId', 'periodId', 'sharedHeader', 'status']),
    );
  });

  it('accepts an optional gradingPeriod + label', () => {
    const gp: GradingPeriod = 'Q2';
    const b: Batch = {
      id: 'b2', yearId: 'y1', courseId: 'c1', periodId: 'p1',
      sharedHeader: 'Note', status: 'sent', gradingPeriod: gp, label: 'Unit 3',
    };
    expect(b.gradingPeriod).toBe('Q2');
    expect(b.label).toBe('Unit 3');
  });
});
