import {
  doc as fbDoc,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreDeleteDeps {
  doc: typeof fbDoc;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeps: FirestoreDeleteDeps = {
  doc: fbDoc,
  deleteDoc: fbDeleteDoc,
};

/**
 * Remove a single student under
 * teachers/{uid}/classes/{classId}/students/{studentId}.
 */
export async function deleteStudent(
  db: Firestore,
  uid: string,
  classId: string,
  studentId: string,
  deps: FirestoreDeleteDeps = defaultDeps,
): Promise<void> {
  const { doc, deleteDoc } = deps;
  await deleteDoc(doc(db, `teachers/${uid}/classes/${classId}/students/${studentId}`));
}
