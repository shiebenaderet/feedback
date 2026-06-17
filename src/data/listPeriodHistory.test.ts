import { describe, it, expect, vi } from 'vitest';
import { listPeriodHistory } from './listPeriodHistory';
import type { FeedbackHistoryEntry } from '../types';

describe('listPeriodHistory', () => {
  it('collection-group reads feedbackHistory filtered by uid + periodId', async () => {
    const db = { __fake: true };

    const collectionGroup = vi.fn((_db: unknown, id: string) => ({ __cg: id }));
    const where = vi.fn((f: string, op: string, v: unknown) => ({ __where: [f, op, v] }));
    const query = vi.fn((coll: unknown, ...clauses: unknown[]) => ({ __query: { coll, clauses } }));
    const snapshot = {
      docs: [
        {
          id: 'h1',
          data: () => ({
            studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 100, gradingPeriod: 'Q1', finalText: 't1',
            tags: { areas: ['cer'], sentiments: ['strength'], standards: [] },
            usedEntries: ['seed-cer-success-1'],
          }),
        },
        {
          id: 'h2',
          data: () => ({
            studentId: 's2', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 150, gradingPeriod: 'Q1', finalText: 't2',
            tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
            usedEntries: ['seed-discussion-growth-1'],
          }),
        },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listPeriodHistory(db as never, 'teacher-1', 'p1', {
      collectionGroup, where, query, getDocs,
    } as never);

    expect(collectionGroup).toHaveBeenCalledWith(db, 'feedbackHistory');
    expect(where).toHaveBeenCalledWith('periodId', '==', 'p1');
    expect(query).toHaveBeenCalledWith({ __cg: 'feedbackHistory' }, { __where: ['periodId', '==', 'p1'] });
    expect(getDocs).toHaveBeenCalledWith({ __query: expect.anything() });

    const expected: FeedbackHistoryEntry[] = [
      { id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 100, gradingPeriod: 'Q1', finalText: 't1', tags: { areas: ['cer'], sentiments: ['strength'], standards: [] }, usedEntries: ['seed-cer-success-1'] },
      { id: 'h2', studentId: 's2', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 150, gradingPeriod: 'Q1', finalText: 't2', tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] }, usedEntries: ['seed-discussion-growth-1'] },
    ];
    expect(result).toEqual(expected);
  });

  it('listCourseHistory filters by courseId instead (course rollup)', async () => {
    const db = { __fake: true };
    const collectionGroup = vi.fn((_db: unknown, id: string) => ({ __cg: id }));
    const where = vi.fn((f: string, op: string, v: unknown) => ({ __where: [f, op, v] }));
    const query = vi.fn((coll: unknown, ...clauses: unknown[]) => ({ __query: { coll, clauses } }));
    const getDocs = vi.fn(async () => ({ docs: [] }));

    const { listCourseHistory } = await import('./listPeriodHistory');
    await listCourseHistory(db as never, 'teacher-1', 'c1', {
      collectionGroup, where, query, getDocs,
    } as never);

    expect(where).toHaveBeenCalledWith('courseId', '==', 'c1');
  });
});
