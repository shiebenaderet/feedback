import { describe, it, expect, vi } from 'vitest';
import { loadComposeData } from './loadComposeData';
import type { ClassMeta } from '../types';

const db = { __fake: true } as never;

describe('loadComposeData', () => {
  it('joins class, students, and bank for a classId', async () => {
    const classes: ClassMeta[] = [
      { id: 'c1', name: 'Period 4', semester: 'S2' },
      { id: 'c2', name: 'Period 1' },
    ];
    const deps = {
      listClasses: vi.fn(async () => classes),
      listStudents: vi.fn(async () => [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: '4' },
      ]),
      listBankEntries: vi.fn(async () => [
        { id: 'e1', templateText: 'Hi {name}', slots: [], tags: {} },
      ]),
    };

    const out = await loadComposeData(db, 'u1', 'c1', deps);

    expect(out.classMeta).toEqual({ id: 'c1', name: 'Period 4', semester: 'S2' });
    expect(out.students).toHaveLength(1);
    expect(out.entries).toHaveLength(1);
    expect(deps.listStudents).toHaveBeenCalledWith(db, 'u1', 'c1');
    expect(deps.listBankEntries).toHaveBeenCalledWith(db, 'u1');
  });

  it('throws a clear error when the class is not found', async () => {
    const deps = {
      listClasses: vi.fn(async () => [] as ClassMeta[]),
      listStudents: vi.fn(async () => []),
      listBankEntries: vi.fn(async () => []),
    };
    await expect(loadComposeData(db, 'u1', 'missing', deps)).rejects.toThrow(
      /class.*not found/i,
    );
  });
});
