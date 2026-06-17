import { describe, it, expect, vi } from 'vitest';
import { loadComposeData } from './loadComposeData';

describe('loadComposeData (period route)', () => {
  it('loads the period roster, bank, and tree ids for a course/period pair', async () => {
    const db = { __fake: true } as any;
    const deps = {
      listPeriods: vi.fn(async () => [
        { id: 'p4', label: 'Period 4', order: 4, courseId: 'co1', yearId: 'y1' },
        { id: 'p5', label: 'Period 5', order: 5, courseId: 'co1', yearId: 'y1' },
      ]),
      listStudents: vi.fn(async () => [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
      ]),
      listBankEntries: vi.fn(async () => [
        { id: 'e1', templateText: 'Great work {name}', slots: [], tags: { area: 'cer', type: 'success' } },
      ]),
    };

    const data = await loadComposeData(db, 'u1', { yearId: 'y1', courseId: 'co1', periodId: 'p4' }, deps as any);

    expect(deps.listPeriods).toHaveBeenCalledWith(db, 'u1', 'y1', 'co1');
    expect(deps.listStudents).toHaveBeenCalledWith(db, 'u1', 'y1', 'co1', 'p4');
    expect(deps.listBankEntries).toHaveBeenCalledWith(db, 'u1');
    expect(data.period).toEqual({ id: 'p4', label: 'Period 4', order: 4, courseId: 'co1', yearId: 'y1' });
    expect(data.courseId).toBe('co1');
    expect(data.yearId).toBe('y1');
    expect(data.students).toHaveLength(1);
    expect(data.entries[0].id).toBe('e1');
  });

  it('throws when the period id is not found under the course', async () => {
    const db = { __fake: true } as any;
    const deps = {
      listPeriods: vi.fn(async () => []),
      listStudents: vi.fn(async () => []),
      listBankEntries: vi.fn(async () => []),
    };
    await expect(
      loadComposeData(db, 'u1', { yearId: 'y1', courseId: 'co1', periodId: 'nope' }, deps as any),
    ).rejects.toThrow('Period not found: nope');
  });
});
