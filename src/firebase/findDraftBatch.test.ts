import { describe, it, expect, vi } from 'vitest';
import { findDraftBatch } from './findDraftBatch';
import type { Batch } from '../types';

describe('findDraftBatch', () => {
  function makeDeps(docs: Array<{ id: string; data: () => Batch }>) {
    return {
      collection: vi.fn((_db: unknown, path: string) => ({ __coll: path })),
      where: vi.fn((f: string, op: string, v: unknown) => ({ __where: [f, op, v] })),
      query: vi.fn((coll: unknown, ...cs: unknown[]) => ({ __q: { coll, cs } })),
      orderBy: vi.fn((f: unknown) => ({ __orderBy: f })),
      documentId: vi.fn(() => '__name__'),
      getDocs: vi.fn(async () => ({ docs })),
    };
  }

  it('queries batches by periodId + draft status, ordered by doc id, returns the first', async () => {
    const db = { __fake: true };
    const draft: Batch = {
      id: 'b1', yearId: 'y1', courseId: 'c1', periodId: 'p1', sharedHeader: 'Hi', status: 'draft',
    };
    const deps = makeDeps([{ id: 'b1', data: () => draft }]);

    const result = await findDraftBatch(db as never, 'u1', 'p1', deps as never);

    expect(deps.collection).toHaveBeenCalledWith(db, 'teachers/u1/batches');
    expect(deps.where).toHaveBeenCalledWith('periodId', '==', 'p1');
    expect(deps.where).toHaveBeenCalledWith('status', '==', 'draft');
    // Deterministic ordering so concurrent-create dupes resolve consistently.
    expect(deps.orderBy).toHaveBeenCalledWith('__name__');
    expect(result).toEqual(draft);
  });

  it('returns null when no draft batch exists for the period', async () => {
    const result = await findDraftBatch({ __fake: true } as never, 'u1', 'p1', makeDeps([]) as never);
    expect(result).toBeNull();
  });
});
