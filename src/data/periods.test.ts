import { describe, it, expect, vi } from 'vitest';
import { createPeriod, listPeriods } from './periods';
import type { Period } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodsPath = `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`;

describe('createPeriod', () => {
  it('writes one period (label + order) and returns its id', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'pd-q1' }));

    const id = await createPeriod(
      db as any,
      uid,
      yearId,
      courseId,
      { label: 'Q1', order: 0 },
      { collection, addDoc } as any,
    );

    expect(id).toBe('pd-q1');
    expect(collection).toHaveBeenCalledWith(db, periodsPath);
    expect(addDoc.mock.calls[0][1]).toEqual({ label: 'Q1', order: 0 });
  });

  it('rejects a label not in GRADING_PERIODS', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn();

    await expect(
      createPeriod(
        db as any,
        uid,
        yearId,
        courseId,
        { label: 'Q9', order: 0 },
        { collection, addDoc } as any,
      ),
    ).rejects.toThrow(/Q9/);
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('listPeriods', () => {
  it('reads the periods subcollection and returns Period[] sorted by order', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 'pd-q2', data: () => ({ label: 'Q2', order: 1 }) },
        { id: 'pd-q1', data: () => ({ label: 'Q1', order: 0 }) },
      ],
    }));

    const result = await listPeriods(db as any, uid, yearId, courseId, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, periodsPath);
    const expected: Period[] = [
      { id: 'pd-q1', label: 'Q1', order: 0 },
      { id: 'pd-q2', label: 'Q2', order: 1 },
    ];
    expect(result).toEqual(expected);
  });
});
