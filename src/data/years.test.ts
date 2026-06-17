import { describe, it, expect, vi } from 'vitest';
import { createYear, getOrCreateCurrentYear, listYears } from './years';

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

  it('resolves DUPLICATE years (same label) deterministically — always the smallest id, never a new one', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    // Firestore returns docs in an UNSPECIFIED order; simulate the dangerous case.
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 'year-zzz', data: () => ({ label: '2025–2026' }) },
        { id: 'year-aaa', data: () => ({ label: '2025–2026' }) },
        { id: 'other', data: () => ({ label: '2024–2025' }) },
      ],
    }));
    const addDoc = vi.fn();

    const first = await getOrCreateCurrentYear(db as any, uid, '2025–2026', {
      collection, getDocs, addDoc,
    } as any);
    const second = await getOrCreateCurrentYear(db as any, uid, '2025–2026', {
      collection, getDocs, addDoc,
    } as any);

    // Every call lands on the SAME year (smallest id) so courses never strand.
    expect(first).toBe('year-aaa');
    expect(second).toBe('year-aaa');
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('listYears', () => {
  it('returns all year docs sorted newest-label-first', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 'y-old', data: () => ({ label: '2024–25' }) },
        { id: 'y-new', data: () => ({ label: '2026–27' }) },
        { id: 'y-mid', data: () => ({ label: '2025–26' }) },
      ],
    }));

    const years = await listYears(db as any, 'u1', { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, 'teachers/u1/years');
    expect(years.map((y) => y.id)).toEqual(['y-new', 'y-mid', 'y-old']);
  });
});
