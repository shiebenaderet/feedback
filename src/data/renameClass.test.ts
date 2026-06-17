import { describe, it, expect, vi } from 'vitest';
import { renameClass } from './renameClass';
import type { ClassMeta } from '../types';

describe('renameClass', () => {
  it('updateDocs the class doc with only the provided fields', async () => {
    const uid = 'teacher-1';
    const classId = 'class-a';
    const db = { __fake: true };

    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const updateDoc = vi.fn(async (_ref: unknown, _patch: unknown) => undefined);

    const patch: Partial<Pick<ClassMeta, 'name' | 'period' | 'semester' | 'unit'>> = {
      name: 'Period 3 Biology (renamed)',
      unit: 'Genetics',
    };

    await renameClass(db as any, uid, classId, patch, { doc, updateDoc } as any);

    expect(doc).toHaveBeenCalledWith(db, `teachers/${uid}/classes/${classId}`);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc.mock.calls[0][1]).toEqual({
      name: 'Period 3 Biology (renamed)',
      unit: 'Genetics',
    });
  });

  it('drops undefined keys so a partial patch never writes undefined', async () => {
    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const updateDoc = vi.fn(async (_ref: unknown, _patch: unknown) => undefined);

    await renameClass(
      { __fake: true } as any,
      'teacher-1',
      'class-a',
      { period: '4', semester: undefined },
      { doc, updateDoc } as any,
    );

    // only `period` survives — `semester: undefined` is stripped
    expect(updateDoc.mock.calls[0][1]).toEqual({ period: '4' });
  });
});
