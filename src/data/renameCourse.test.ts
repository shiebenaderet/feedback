import { describe, it, expect, vi } from 'vitest';
import { renameCourse, archiveCourse } from './renameCourse';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const path = `teachers/${uid}/years/${yearId}/courses/${courseId}`;

describe('renameCourse', () => {
  it('updates the name at the nested course path', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await renameCourse(db as any, uid, yearId, courseId, 'New Name', { doc, updateDoc } as any);

    expect(doc).toHaveBeenCalledWith(db, path);
    expect(updateDoc).toHaveBeenCalledWith({ __path: path }, { name: 'New Name' });
  });
});

describe('archiveCourse', () => {
  it('sets archived=true', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await archiveCourse(db as any, uid, yearId, courseId, true, { doc, updateDoc } as any);

    expect(updateDoc).toHaveBeenCalledWith({ __path: path }, { archived: true });
  });

  it('clears archived with false (restore)', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await archiveCourse(db as any, uid, yearId, courseId, false, { doc, updateDoc } as any);

    expect(updateDoc).toHaveBeenCalledWith({ __path: path }, { archived: false });
  });
});
