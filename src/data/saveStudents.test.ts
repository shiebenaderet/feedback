import { describe, it, expect, vi } from 'vitest';
import { saveStudents } from './saveStudents';
import type { Student } from '../types';

describe('saveStudents', () => {
  it('writes each student under teachers/{uid}/classes/{classId}/students', async () => {
    const uid = 'teacher-1';
    const classId = 'class-a';
    const db = { __fake: true };

    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'generated' }));

    const students: Student[] = [
      { id: 's1', name: 'Ada Lovelace', email: 'ada@example.com', period: '3' },
      { id: 's2', name: 'Alan Turing', email: 'alan@example.com', period: '3' },
    ];

    const count = await saveStudents(
      db as any,
      uid,
      classId,
      students,
      { collection, addDoc } as any,
    );

    expect(count).toBe(2);
    // Corrected nested path — NOT a top-level collection.
    expect(collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students`,
    );
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      period: '3',
    });
    expect(addDoc.mock.calls[1][1]).toEqual({
      name: 'Alan Turing',
      email: 'alan@example.com',
      period: '3',
    });
  });
});
