import { describe, it, expect, vi } from 'vitest';
import { listStudentHistory } from './listStudentHistory';
import type { FeedbackHistoryEntry } from '../types';

describe('listStudentHistory', () => {
  it('reads the student feedbackHistory subcollection ordered by sentAt desc and maps to FeedbackHistoryEntry[]', async () => {
    const db = { __fake: true };
    const uid = 'teacher-1';
    const loc = { yearId: 'y1', courseId: 'c1', periodId: 'p1', studentId: 's1' };

    const collection = vi.fn((_db: unknown, path: string) => ({ __coll: path }));
    const orderBy = vi.fn((field: string, dir: string) => ({ __orderBy: [field, dir] }));
    const query = vi.fn((coll: unknown, ...clauses: unknown[]) => ({ __query: { coll, clauses } }));
    const snapshot = {
      docs: [
        {
          id: 'h2',
          data: () => ({
            studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 200, gradingPeriod: 'Q2', label: 'Quarter check-in',
            finalText: 'Strong quarter, Ada.',
            tags: { areas: ['cer'], sentiments: ['strength'], standards: ['argumentation'] },
            usedEntries: ['seed-cer-success-1'],
          }),
        },
        {
          id: 'h1',
          data: () => ({
            studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 100, gradingPeriod: 'Q1',
            finalText: 'Welcome, Ada.',
            tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
            usedEntries: ['seed-discussion-growth-1'],
          }),
        },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listStudentHistory(db as never, uid, loc, {
      collection, orderBy, query, getDocs,
    } as never);

    expect(collection).toHaveBeenCalledWith(
      db,
      'teachers/teacher-1/years/y1/courses/c1/periods/p1/students/s1/feedbackHistory',
    );
    expect(orderBy).toHaveBeenCalledWith('sentAt', 'desc');
    expect(query).toHaveBeenCalledWith({ __coll: expect.any(String) }, { __orderBy: ['sentAt', 'desc'] });
    expect(getDocs).toHaveBeenCalledWith({ __query: expect.anything() });

    const expected: FeedbackHistoryEntry[] = [
      {
        id: 'h2', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
        sentAt: 200, gradingPeriod: 'Q2', label: 'Quarter check-in',
        finalText: 'Strong quarter, Ada.',
        tags: { areas: ['cer'], sentiments: ['strength'], standards: ['argumentation'] },
        usedEntries: ['seed-cer-success-1'],
      },
      {
        id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
        sentAt: 100, gradingPeriod: 'Q1',
        finalText: 'Welcome, Ada.',
        tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
        usedEntries: ['seed-discussion-growth-1'],
      },
    ];
    expect(result).toEqual(expected);
  });
});
