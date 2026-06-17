import { describe, it, expect, vi } from 'vitest';
import { updateStudent } from './updateStudent';

describe('updateStudent', () => {
  const uid = 'teacher-1';
  const classId = 'class-a';
  const studentId = 's1';
  const db = { __fake: true };

  function makeDeps() {
    return {
      doc: vi.fn((_db: unknown, path: string) => ({ __path: path })),
      updateDoc: vi.fn(async (_ref: unknown, _patch: unknown) => undefined),
    };
  }

  it('updateDocs the patch at teachers/{uid}/classes/{classId}/students/{studentId}', async () => {
    const deps = makeDeps();
    await updateStudent(
      db as any,
      uid,
      classId,
      studentId,
      { name: 'Ada L.', period: '4' },
      deps as any,
    );
    expect(deps.doc).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students/${studentId}`,
    );
    expect(deps.updateDoc).toHaveBeenCalledTimes(1);
    expect(deps.updateDoc.mock.calls[0][1]).toEqual({ name: 'Ada L.', period: '4' });
  });

  it('accepts a valid email patch', async () => {
    const deps = makeDeps();
    await updateStudent(
      db as any,
      uid,
      classId,
      studentId,
      { email: 'ada@example.com' },
      deps as any,
    );
    expect(deps.updateDoc.mock.calls[0][1]).toEqual({ email: 'ada@example.com' });
  });

  it('rejects an invalid email patch and never writes', async () => {
    const deps = makeDeps();
    await expect(
      updateStudent(db as any, uid, classId, studentId, { email: 'nope' }, deps as any),
    ).rejects.toThrow(/invalid email/i);
    expect(deps.updateDoc).not.toHaveBeenCalled();
  });

  it('only sends the provided keys (partial patch)', async () => {
    const deps = makeDeps();
    await updateStudent(db as any, uid, classId, studentId, { period: '2' }, deps as any);
    expect(deps.updateDoc.mock.calls[0][1]).toEqual({ period: '2' });
  });
});
