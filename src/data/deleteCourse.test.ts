import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the modular Firestore SDK (un-injected path), path-shaped like deleteClass.test.
const mocks = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  doc: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  getDocs: vi.fn(async (ref: { __path: string }) => {
    // periods under the course
    if (ref.__path.endsWith('/periods')) {
      return { docs: [{ id: 'pd1' }] };
    }
    // students under a period
    if (ref.__path.endsWith('/students')) {
      return { docs: [{ id: 'st1' }, { id: 'st2' }] };
    }
    // feedbackHistory under a student
    if (ref.__path.endsWith('/feedbackHistory')) {
      return { docs: [{ id: 'fh1' }] };
    }
    return { docs: [] };
  }),
  deleteDoc: vi.fn(async (_ref: { __path: string }) => undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  getDocs: mocks.getDocs,
  deleteDoc: mocks.deleteDoc,
}));

import { deleteCourse } from './deleteCourse';

const db = { __type: 'firestore' } as never;
const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const coursePath = `teachers/${uid}/years/${yearId}/courses/${courseId}`;
const periodPath = `${coursePath}/periods/pd1`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteCourse (destructive deep cascade)', () => {
  it('deletes feedbackHistory, students, periods, then the course doc', async () => {
    await deleteCourse(db, uid, yearId, courseId);

    // enumerated each level
    expect(mocks.collection).toHaveBeenCalledWith(db, `${coursePath}/periods`);
    expect(mocks.collection).toHaveBeenCalledWith(db, `${periodPath}/students`);
    expect(mocks.collection).toHaveBeenCalledWith(db, `${periodPath}/students/st1/feedbackHistory`);

    // deleted the deepest doc
    expect(mocks.doc).toHaveBeenCalledWith(
      db,
      `${periodPath}/students/st1/feedbackHistory/fh1`,
    );
    // deleted students
    expect(mocks.doc).toHaveBeenCalledWith(db, `${periodPath}/students/st1`);
    expect(mocks.doc).toHaveBeenCalledWith(db, `${periodPath}/students/st2`);
    // deleted the period
    expect(mocks.doc).toHaveBeenCalledWith(db, periodPath);
    // deleted the course doc itself
    expect(mocks.doc).toHaveBeenCalledWith(db, coursePath);
  });

  it('deletes the course doc LAST', async () => {
    const order: string[] = [];
    mocks.deleteDoc.mockImplementation(async (ref: { __path: string }) => {
      order.push(ref.__path);
      return undefined;
    });

    await deleteCourse(db, uid, yearId, courseId);

    expect(order[order.length - 1]).toBe(coursePath);
    // feedbackHistory (deepest) is removed before its student
    expect(order.indexOf(`${periodPath}/students/st1/feedbackHistory/fh1`)).toBeLessThan(
      order.indexOf(`${periodPath}/students/st1`),
    );
    // students removed before their period
    expect(order.indexOf(`${periodPath}/students/st1`)).toBeLessThan(order.indexOf(periodPath));
  });

  it('still deletes the course doc when there are no children', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] } as never);

    await deleteCourse(db, uid, yearId, courseId);

    expect(mocks.deleteDoc).toHaveBeenCalledWith({ __path: coursePath });
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
  });
});
