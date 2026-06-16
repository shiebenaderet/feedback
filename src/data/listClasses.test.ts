import { describe, it, expect, vi } from 'vitest';
import { listClasses } from './listClasses';
import type { ClassMeta } from '../types';

describe('listClasses', () => {
  it('reads teachers/{uid}/classes and maps docs to ClassMeta[]', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };

    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const snapshot = {
      docs: [
        { id: 'class-a', data: () => ({ name: 'Bio', period: '1', semester: 'Fall', unit: 'Cells' }) },
        { id: 'class-b', data: () => ({ name: 'Chem', period: '2' }) },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listClasses(db as any, uid, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/classes`);
    const expected: ClassMeta[] = [
      { id: 'class-a', name: 'Bio', period: '1', semester: 'Fall', unit: 'Cells' },
      { id: 'class-b', name: 'Chem', period: '2' },
    ];
    expect(result).toEqual(expected);
  });
});
