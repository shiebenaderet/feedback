import {
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Student } from '../types';

/** Same shape the roster importer validates with (src/roster/parseRoster.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Editable subset of a student. */
export type StudentPatch = Partial<Pick<Student, 'name' | 'email' | 'period'>>;

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

const defaultDeps: FirestoreUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

/**
 * Patch a student under teachers/{uid}/classes/{classId}/students/{studentId}.
 * Re-validates email when the patch includes one; an invalid email is rejected
 * before any write reaches Firestore.
 */
export async function updateStudent(
  db: Firestore,
  uid: string,
  classId: string,
  studentId: string,
  patch: StudentPatch,
  deps: FirestoreUpdateDeps = defaultDeps,
): Promise<void> {
  if (patch.email !== undefined && !EMAIL_RE.test(patch.email)) {
    throw new Error(`Invalid email: ${patch.email}`);
  }
  const { doc, updateDoc } = deps;
  const ref = doc(db, `teachers/${uid}/classes/${classId}/students/${studentId}`);
  await updateDoc(ref, { ...patch });
}
