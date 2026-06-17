import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock the modular Firestore SDK (un-injected path) ---
const mocks = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  doc: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  getDocs: vi.fn(async (ref: { __path: string }) => {
    if (ref.__path.endsWith('/students')) {
      return { docs: [{ id: 's1' }, { id: 's2' }] };
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

import { deleteClass } from './deleteClass';

const db = { __type: 'firestore' } as never;
const uid = 'teacher-1';
const classId = 'class-a';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteClass (destructive cascade)', () => {
  it('deletes every student in the subcollection, then the class doc', async () => {
    await deleteClass(db, uid, classId);

    // enumerated the students subcollection
    expect(mocks.collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students`,
    );
    // deleted both student child docs
    expect(mocks.doc).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students/s1`,
    );
    expect(mocks.doc).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students/s2`,
    );
    // and the class doc itself
    expect(mocks.doc).toHaveBeenCalledWith(db, `teachers/${uid}/classes/${classId}`);

    // 2 students + 1 class doc = 3 deletes (no batches/messages in this fixture)
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(3);
  });

  it('deletes the class doc LAST (after its children)', async () => {
    const order: string[] = [];
    mocks.deleteDoc.mockImplementation(async (ref: { __path: string }) => {
      order.push(ref.__path);
      return undefined;
    });

    await deleteClass(db, uid, classId);

    const classDocPath = `teachers/${uid}/classes/${classId}`;
    expect(order[order.length - 1]).toBe(classDocPath);
    // the class doc is not deleted before its students
    expect(order.indexOf(classDocPath)).toBe(order.length - 1);
  });

  it('still deletes the class doc when there are no children', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] } as never);

    await deleteClass(db, uid, classId);

    expect(mocks.deleteDoc).toHaveBeenCalledWith({
      __path: `teachers/${uid}/classes/${classId}`,
    });
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
  });
});
