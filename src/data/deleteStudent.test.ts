import { describe, it, expect, vi } from 'vitest';
import { deleteStudent } from './deleteStudent';

describe('deleteStudent', () => {
  it('deleteDocs the student at teachers/{uid}/classes/{classId}/students/{studentId}', async () => {
    const uid = 'teacher-1';
    const classId = 'class-a';
    const studentId = 's1';
    const db = { __fake: true };

    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const deleteDoc = vi.fn(async (_ref: unknown) => undefined);

    await deleteStudent(db as any, uid, classId, studentId, { doc, deleteDoc } as any);

    expect(doc).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students/${studentId}`,
    );
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc.mock.calls[0][0]).toEqual({
      __path: `teachers/${uid}/classes/${classId}/students/${studentId}`,
    });
  });
});
