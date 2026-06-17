import { describe, it, expect, vi } from 'vitest';
import { listFeedbackHistory } from './listFeedbackHistory';
import type { FeedbackHistoryEntry } from '../types';

describe('listFeedbackHistory', () => {
  it('queries the feedbackHistory collection-group scoped by owner + tree ids', async () => {
    const db = { __fake: true } as never;
    const entry = {
      studentId: 's1',
      periodId: 'p1',
      courseId: 'c1',
      yearId: 'y1',
      sentAt: 1,
      gradingPeriod: 'Q1' as const,
      finalText: 'Hi',
      tags: { areas: [], sentiments: [], standards: [] },
      usedEntries: [],
    } satisfies FeedbackHistoryEntry;

    const collectionGroup = vi.fn((_db: unknown, name: string) => ({ __group: name }));
    const where = vi.fn((field: string, op: string, val: unknown) => ({ field, op, val }));
    const query = vi.fn((base: unknown, ...cs: unknown[]) => ({ base, cs }));
    const getDocs = vi.fn(async () => ({ docs: [{ data: () => entry }] }));

    const result = await listFeedbackHistory(
      db,
      'teacher-1',
      { yearId: 'y1', courseId: 'c1', periodId: 'p1' },
      { collection: vi.fn(), collectionGroup, getDocs, query, where } as never,
    );

    expect(collectionGroup).toHaveBeenCalledWith(db, 'feedbackHistory');
    expect(where).toHaveBeenCalledWith('ownerUid', '==', 'teacher-1');
    expect(where).toHaveBeenCalledWith('yearId', '==', 'y1');
    expect(where).toHaveBeenCalledWith('courseId', '==', 'c1');
    expect(where).toHaveBeenCalledWith('periodId', '==', 'p1');
    expect(result).toEqual([entry]);
  });

  it('omits course/period/student filters when not in scope', async () => {
    const where = vi.fn((field: string) => ({ field }));
    const query = vi.fn();
    await listFeedbackHistory(
      { __fake: true } as never,
      'teacher-1',
      { yearId: 'y1' },
      {
        collection: vi.fn(),
        collectionGroup: vi.fn(),
        getDocs: vi.fn(async () => ({ docs: [] })),
        query,
        where,
      } as never,
    );
    const fields = where.mock.calls.map((c) => c[0]);
    expect(fields).toEqual(['ownerUid', 'yearId']);
  });
});
