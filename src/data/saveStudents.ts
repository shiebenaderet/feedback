import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Student } from '../types';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultDeps: FirestoreWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Persist imported students under their class.
 *
 * CORRECTED PATH: teachers/{uid}/classes/{classId}/students/{studentId}
 * (the old top-level `students` collection is gone — that path is denied by the
 * security rules and never read by the roster/compose screens).
 *
 * Returns the number of students written.
 */
export async function saveStudents(
  db: Firestore,
  uid: string,
  classId: string,
  students: Student[],
  deps: FirestoreWriteDeps = defaultDeps,
): Promise<number> {
  const { collection, addDoc } = deps;
  const ref = collection(db, `teachers/${uid}/classes/${classId}/students`);

  for (const s of students) {
    await addDoc(ref, {
      name: s.name,
      email: s.email,
      period: s.period,
    });
  }

  return students.length;
}
