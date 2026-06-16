import { describe, it, expect, vi } from 'vitest';
import { listStudents } from './listStudents';
import type { RosterStudent } from '../roster/RosterTable';

describe('listStudents', () => {
  it('reads teachers/{uid}/classes/{classId}/students and maps docs to RosterStudent[]', async () => {
    const uid = 'teacher-1';
    const classId = 'class-a';
    const db = { __fake: true };

    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const snapshot = {
      docs: [
        { id: 's1', data: () => ({ name: 'Ada', email: 'ada@x.edu', period: '3' }) },
        { id: 's2', data: () => ({ name: 'Alan', email: 'alan@x.edu' }) },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listStudents(db as never, uid, classId, {
      collection,
      getDocs,
    } as never);

    expect(collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students`,
    );
    const expected: RosterStudent[] = [
      { id: 's1', name: 'Ada', email: 'ada@x.edu', period: '3' },
      { id: 's2', name: 'Alan', email: 'alan@x.edu', period: '' },
    ];
    expect(result).toEqual(expected);
  });
});
