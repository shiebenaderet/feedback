import { describe, it, expect, vi } from 'vitest';
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
} from './assignments';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c-ush';
const base = `teachers/${uid}/years/${yearId}/courses/${courseId}/assignments`;

describe('createAssignment', () => {
  it('writes to the course assignments path with a createdAt and returns the id', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'a-1' }));
    const now = () => 1000;

    const id = await createAssignment(
      db as any,
      uid,
      yearId,
      courseId,
      { title: 'Revolution DBQ', standardCodes: ['H3.6-8.4', 'SSS4.6-8.1'], summative: true, periodIds: ['p1'] },
      { collection, addDoc, now } as any,
    );

    expect(id).toBe('a-1');
    expect(collection).toHaveBeenCalledWith(db, base);
    expect(addDoc.mock.calls[0][1]).toEqual({
      title: 'Revolution DBQ',
      standardCodes: ['H3.6-8.4', 'SSS4.6-8.1'],
      summative: true,
      periodIds: ['p1'],
      createdAt: 1000,
    });
  });
});

describe('listAssignments', () => {
  it('maps docs to Assignment[] sorted newest-first', async () => {
    const snapshot = {
      docs: [
        { id: 'old', data: () => ({ title: 'Q1 quiz', standardCodes: [], summative: false, periodIds: ['p1'], createdAt: 1 }) },
        { id: 'new', data: () => ({ title: 'DBQ', standardCodes: ['H3.6-8.4'], summative: true, periodIds: ['p1', 'p2'], createdAt: 99 }) },
      ],
    };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => snapshot);

    const result = await listAssignments({ __fake: true } as any, uid, yearId, courseId, {
      collection,
      getDocs,
    } as any);

    expect(collection).toHaveBeenCalledWith({ __fake: true }, base);
    expect(result.map((a) => a.id)).toEqual(['new', 'old']);
    expect(result[0]).toMatchObject({ id: 'new', title: 'DBQ', summative: true, yearId, courseId });
  });
});

describe('getAssignment', () => {
  it('returns the assignment when it exists', async () => {
    const doc = vi.fn((_db: unknown, path: string, id: string) => ({ __path: `${path}/${id}` }));
    const getDoc = vi.fn(async () => ({
      exists: () => true,
      id: 'a-1',
      data: () => ({ title: 'DBQ', standardCodes: ['H3.6-8.4'], summative: true, periodIds: ['p1'], createdAt: 5 }),
    }));

    const a = await getAssignment({ __fake: true } as any, uid, yearId, courseId, 'a-1', {
      doc,
      getDoc,
    } as any);

    expect(a?.title).toBe('DBQ');
    expect(a?.standardCodes).toEqual(['H3.6-8.4']);
  });

  it('returns null when missing', async () => {
    const doc = vi.fn(() => ({}));
    const getDoc = vi.fn(async () => ({ exists: () => false }));
    const a = await getAssignment({ __fake: true } as any, uid, yearId, courseId, 'nope', {
      doc,
      getDoc,
    } as any);
    expect(a).toBeNull();
  });
});

describe('updateAssignment / deleteAssignment', () => {
  it('updates the doc at the assignment path', async () => {
    const doc = vi.fn((_db: unknown, path: string, id: string) => ({ __ref: `${path}/${id}` }));
    const updateDoc = vi.fn(async (_ref: unknown, _patch: unknown) => {});
    await updateAssignment({ __fake: true } as any, uid, yearId, courseId, 'a-1', { title: 'Renamed' }, {
      doc,
      updateDoc,
    } as any);
    expect(doc).toHaveBeenCalledWith({ __fake: true }, base, 'a-1');
    expect(updateDoc.mock.calls[0][1]).toEqual({ title: 'Renamed' });
  });

  it('deletes the doc at the assignment path', async () => {
    const doc = vi.fn((_db: unknown, path: string, id: string) => ({ __ref: `${path}/${id}` }));
    const deleteDoc = vi.fn(async () => {});
    await deleteAssignment({ __fake: true } as any, uid, yearId, courseId, 'a-1', {
      doc,
      deleteDoc,
    } as any);
    expect(doc).toHaveBeenCalledWith({ __fake: true }, base, 'a-1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});
