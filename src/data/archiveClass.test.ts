import { describe, it, expect, vi } from 'vitest';
import { archiveClass } from './archiveClass';

describe('archiveClass', () => {
  it('updateDocs archived:true on the class doc', async () => {
    const uid = 'teacher-1';
    const classId = 'class-a';
    const db = { __fake: true };

    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const updateDoc = vi.fn(async (_ref: unknown, _patch: unknown) => undefined);

    await archiveClass(db as any, uid, classId, true, { doc, updateDoc } as any);

    expect(doc).toHaveBeenCalledWith(db, `teachers/${uid}/classes/${classId}`);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc.mock.calls[0][1]).toEqual({ archived: true });
  });

  it('can un-archive by passing false', async () => {
    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const updateDoc = vi.fn(async (_ref: unknown, _patch: unknown) => undefined);

    await archiveClass(
      { __fake: true } as any,
      'teacher-1',
      'class-a',
      false,
      { doc, updateDoc } as any,
    );

    expect(updateDoc.mock.calls[0][1]).toEqual({ archived: false });
  });
});
