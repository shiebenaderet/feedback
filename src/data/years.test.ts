import { describe, it, expect, vi } from 'vitest';
import { createYear, getOrCreateCurrentYear } from './years';

describe('createYear', () => {
  it('writes to teachers/{uid}/years and returns the new yearId', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'year-xyz' }));

    const yearId = await createYear(db as any, uid, '2025–2026', { collection, addDoc } as any);

    expect(yearId).toBe('year-xyz');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years`);
    expect(addDoc.mock.calls[0][1]).toEqual({ label: '2025–2026' });
  });
});

describe('getOrCreateCurrentYear', () => {
  it('returns the id of an existing matching year without writing', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [{ id: 'year-existing', data: () => ({ label: '2025–2026' }) }],
    }));
    const addDoc = vi.fn();

    const yearId = await getOrCreateCurrentYear(
      db as any,
      uid,
      '2025–2026',
      { collection, getDocs, addDoc } as any,
    );

    expect(yearId).toBe('year-existing');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('creates the year when no doc with that label exists', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({ docs: [] }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'year-new' }));

    const yearId = await getOrCreateCurrentYear(
      db as any,
      uid,
      '2026–2027',
      { collection, getDocs, addDoc } as any,
    );

    expect(yearId).toBe('year-new');
    expect(addDoc).toHaveBeenCalledWith({ __path: `teachers/${uid}/years` }, { label: '2026–2027' });
  });
});
