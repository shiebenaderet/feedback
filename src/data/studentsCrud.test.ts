import { describe, it, expect, vi } from 'vitest';
import { updateStudent, deleteStudent } from './students';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodId = 'p1';
const studentId = 's1';
const studentPath =
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students/${studentId}`;

describe('updateStudent (nested period path)', () => {
  it('patches the student at the nested path', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await updateStudent(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      studentId,
      { name: 'Ada L.' },
      { doc, updateDoc } as any,
    );

    expect(doc).toHaveBeenCalledWith(db, studentPath);
    expect(updateDoc).toHaveBeenCalledWith({ __path: studentPath }, { name: 'Ada L.' });
  });

  it('rejects an invalid email before writing', async () => {
    const db = { __fake: true };
    const doc = vi.fn();
    const updateDoc = vi.fn();

    await expect(
      updateStudent(
        db as any,
        uid,
        yearId,
        courseId,
        periodId,
        studentId,
        { email: 'not-an-email' },
        { doc, updateDoc } as any,
      ),
    ).rejects.toThrow(/Invalid email/);
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('deleteStudent (nested period path)', () => {
  it('deletes the student at the nested path', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const deleteDoc = vi.fn(async () => undefined);

    await deleteStudent(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      studentId,
      { doc, deleteDoc } as any,
    );

    expect(doc).toHaveBeenCalledWith(db, studentPath);
    expect(deleteDoc).toHaveBeenCalledWith({ __path: studentPath });
  });
});
