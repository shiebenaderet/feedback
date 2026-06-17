import { describe, it, expect, vi } from 'vitest';
import { findDraftBatch } from './findDraftBatch';
import type { Batch } from '../types';

describe('findDraftBatch', () => {
  it('queries batches by periodId + draft status and returns the first match', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __coll: path }));
    const where = vi.fn((f: string, op: string, v: unknown) => ({ __where: [f, op, v] }));
    const query = vi.fn((coll: unknown, ...cs: unknown[]) => ({ __q: { coll, cs } }));
    const draft: Batch = {
      id: 'b1', yearId: 'y1', courseId: 'c1', periodId: 'p1', sharedHeader: 'Hi', status: 'draft',
    };
    const getDocs = vi.fn(async () => ({ docs: [{ id: 'b1', data: () => draft }] }));

    const result = await findDraftBatch(db as never, 'u1', 'p1', {
      collection, where, query, getDocs,
    } as never);

    expect(collection).toHaveBeenCalledWith(db, 'teachers/u1/batches');
    expect(where).toHaveBeenCalledWith('periodId', '==', 'p1');
    expect(where).toHaveBeenCalledWith('status', '==', 'draft');
    expect(result).toEqual(draft);
  });

  it('returns null when no draft batch exists for the period', async () => {
    const db = { __fake: true };
    const deps = {
      collection: vi.fn(() => ({})),
      where: vi.fn(() => ({})),
      query: vi.fn(() => ({})),
      getDocs: vi.fn(async () => ({ docs: [] })),
    };
    const result = await findDraftBatch(db as never, 'u1', 'p1', deps as never);
    expect(result).toBeNull();
  });
});
