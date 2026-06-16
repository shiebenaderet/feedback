import { describe, it, expect, vi } from 'vitest';
import { createClass } from './createClass';
import type { ClassMeta } from '../types';

describe('createClass', () => {
  it('writes to teachers/{uid}/classes and returns the new classId', async () => {
    const uid = 'teacher-1';
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'class-xyz' }));
    const db = { __fake: true };

    const input: Omit<ClassMeta, 'id'> = {
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    };

    const classId = await createClass(db as any, uid, input, { collection, addDoc } as any);

    expect(classId).toBe('class-xyz');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/classes`);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    });
  });
});
