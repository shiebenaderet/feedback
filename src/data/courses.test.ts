import { describe, it, expect, vi } from 'vitest';
import { createCourse, listCourses } from './courses';
import type { Course } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';

describe('createCourse', () => {
  it('writes to teachers/{uid}/years/{yearId}/courses and returns the new id', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'course-1' }));

    const courseId = await createCourse(
      db as any,
      uid,
      yearId,
      'Period 3 Biology',
      { collection, addDoc } as any,
    );

    expect(courseId).toBe('course-1');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years/${yearId}/courses`);
    expect(addDoc.mock.calls[0][1]).toEqual({ name: 'Period 3 Biology' });
  });
});

describe('listCourses', () => {
  const snapshot = {
    docs: [
      { id: 'c-a', data: () => ({ name: 'Bio' }) },
      { id: 'c-z', data: () => ({ name: 'Old', archived: true }) },
    ],
  };

  it('reads the courses subcollection and maps to Course[], hiding archived by default', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => snapshot);

    const result = await listCourses(db as any, uid, yearId, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years/${yearId}/courses`);
    const expected: Course[] = [{ id: 'c-a', name: 'Bio' }];
    expect(result).toEqual(expected);
  });

  it('includes archived courses when includeArchived is true', async () => {
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => snapshot);

    const result = await listCourses(
      { __fake: true } as any,
      uid,
      yearId,
      { collection, getDocs } as any,
      { includeArchived: true },
    );

    expect(result.map((c) => c.id)).toEqual(['c-a', 'c-z']);
    expect(result.find((c) => c.id === 'c-z')?.archived).toBe(true);
  });
});
