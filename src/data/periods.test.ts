import { describe, it, expect, vi } from 'vitest';
import { createPeriod, listPeriods } from './periods';
import type { Period } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodsPath = `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`;

describe('createPeriod', () => {
  it('writes one class period (label + order) and returns its id', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'pd-1' }));

    const id = await createPeriod(
      db as any,
      uid,
      yearId,
      courseId,
      { label: 'Period 1', order: 1 },
      { collection, addDoc } as any,
    );

    expect(id).toBe('pd-1');
    expect(collection).toHaveBeenCalledWith(db, periodsPath);
    expect(addDoc.mock.calls[0][1]).toEqual({ label: 'Period 1', order: 1 });
  });

  it('accepts a free-form custom period label (class periods are not a fixed set)', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'pd-block-a' }));

    const id = await createPeriod(
      db as any,
      uid,
      yearId,
      courseId,
      { label: 'Block A', order: 7 },
      { collection, addDoc } as any,
    );

    expect(id).toBe('pd-block-a');
    expect(addDoc.mock.calls[0][1]).toEqual({ label: 'Block A', order: 7 });
  });
});

describe('listPeriods', () => {
  it('reads the periods subcollection and returns Period[] sorted by order', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 'pd-2', data: () => ({ label: 'Period 2', order: 2 }) },
        { id: 'pd-1', data: () => ({ label: 'Period 1', order: 1 }) },
      ],
    }));

    const result = await listPeriods(db as any, uid, yearId, courseId, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, periodsPath);
    const expected: Period[] = [
      { id: 'pd-1', label: 'Period 1', order: 1 },
      { id: 'pd-2', label: 'Period 2', order: 2 },
    ];
    expect(result).toEqual(expected);
  });
});
