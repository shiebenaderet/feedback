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

  const archivedSnapshot = {
    docs: [
      { id: 'class-a', data: () => ({ name: 'Active' }) },
      { id: 'class-z', data: () => ({ name: 'Old', archived: true }) },
    ],
  };

  it('hides archived classes by default', async () => {
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => archivedSnapshot);
    const result = await listClasses({ __fake: true } as any, 'teacher-1', {
      collection,
      getDocs,
    } as any);
    expect(result.map((c) => c.id)).toEqual(['class-a']);
  });

  it('includes archived classes when includeArchived is true', async () => {
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => archivedSnapshot);
    const result = await listClasses(
      { __fake: true } as any,
      'teacher-1',
      { collection, getDocs } as any,
      { includeArchived: true },
    );
    expect(result.map((c) => c.id)).toEqual(['class-a', 'class-z']);
    expect(result.find((c) => c.id === 'class-z')?.archived).toBe(true);
  });
});
