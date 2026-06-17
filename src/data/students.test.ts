import { describe, it, expect, vi } from 'vitest';
import { saveStudents, listStudents } from './students';
import type { Student } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodId = 'p1';
const studentsPath =
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students`;

function makeWriteDeps() {
  const docs: Array<{ path: string; id: string; data: unknown; merge: unknown }> = [];
  return {
    docs,
    doc: vi.fn((_db: unknown, path: string, id: string) => ({ __path: path, __id: id })),
    setDoc: vi.fn(async (ref: any, data: unknown, opts: unknown) => {
      docs.push({ path: ref.__path, id: ref.__id, data, merge: opts });
    }),
  };
}

describe('saveStudents (upsert by email)', () => {
  it('writes each student at a DETERMINISTIC id derived from their email (merge)', async () => {
    const db = { __fake: true };
    const deps = makeWriteDeps();

    const students: Student[] = [
      { id: 's1', name: 'Ada Lovelace', email: 'Ada@Example.com', period: '3' },
      { id: 's2', name: 'Alan Turing', email: 'alan@example.com', period: '3' },
    ];

    const count = await saveStudents(db as any, uid, yearId, courseId, periodId, students, deps as any);

    expect(count).toBe(2);
    expect(deps.docs).toHaveLength(2);
    for (const d of deps.docs) {
      expect(d.path).toBe(studentsPath);
      expect(d.merge).toEqual({ merge: true });
    }
    // Email is normalized (lowercased/trimmed) for the id, so casing can't dupe.
    expect(deps.docs[0].id).toBe(deps.docs[0].id.toLowerCase());
    expect(deps.docs[0].data).toEqual({
      name: 'Ada Lovelace',
      email: 'Ada@Example.com',
      period: '3',
    });
  });

  it('is idempotent: re-saving the SAME student lands on the SAME doc id (no duplicate)', async () => {
    const db = { __fake: true };
    const deps = makeWriteDeps();
    const ada: Student[] = [{ id: 's1', name: 'Ada', email: 'ada@example.com', period: '3' }];

    await saveStudents(db as any, uid, yearId, courseId, periodId, ada, deps as any);
    // Re-import the same roster (same email, different casing/whitespace).
    await saveStudents(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      [{ id: 'x', name: 'Ada L.', email: '  ADA@example.com ', period: '3' }],
      deps as any,
    );

    expect(deps.docs[0].id).toBe(deps.docs[1].id);
  });

  it('skips a student with no usable email rather than minting an unkeyed dupe', async () => {
    const db = { __fake: true };
    const deps = makeWriteDeps();
    await saveStudents(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      [{ id: 's1', name: 'No Email', email: '', period: '3' }],
      deps as any,
    );
    expect(deps.docs).toHaveLength(0);
  });
});

describe('listStudents (nested period path)', () => {
  it('reads the period students subcollection and maps docs to Student[]', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 's1', data: () => ({ name: 'Ada', email: 'ada@example.com', period: '3' }) },
        { id: 's2', data: () => ({ name: 'Alan', email: 'alan@example.com' }) },
      ],
    }));

    const result = await listStudents(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      { collection, getDocs } as any,
    );

    expect(collection).toHaveBeenCalledWith(db, studentsPath);
    const expected: Student[] = [
      { id: 's1', name: 'Ada', email: 'ada@example.com', period: '3' },
      { id: 's2', name: 'Alan', email: 'alan@example.com' },
    ];
    expect(result).toEqual(expected);
  });
});
