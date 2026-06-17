import { describe, it, expect, vi } from 'vitest';
import { saveStudents, listStudents } from './students';
import type { Student } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodId = 'p1';
const studentsPath =
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students`;

describe('saveStudents (nested period path)', () => {
  it('writes each student under the period students subcollection', async () => {
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
      yearId,
      courseId,
      periodId,
      students,
      { collection, addDoc } as any,
    );

    expect(count).toBe(2);
    expect(collection).toHaveBeenCalledWith(db, studentsPath);
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      period: '3',
    });
  });
});

describe('listStudents (nested period path)', () => {
  it('reads the period students subcollection and maps docs to Student[]', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 's1', data: () => ({ name: 'Ada', email: 'ada@example.com', period: '3' }) },
        { id: 's2', data: () => ({ name: 'Alan', email: 'alan@example.com' }) },
      ],
    }));

    const result = await listStudents(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      { collection, getDocs } as any,
    );

    expect(collection).toHaveBeenCalledWith(db, studentsPath);
    const expected: Student[] = [
      { id: 's1', name: 'Ada', email: 'ada@example.com', period: '3' },
      { id: 's2', name: 'Alan', email: 'alan@example.com' },
    ];
    expect(result).toEqual(expected);
  });
});
