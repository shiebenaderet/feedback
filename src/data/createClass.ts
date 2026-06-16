import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { ClassMeta } from '../types';

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
 * Create a class under the signed-in teacher and return its new id.
 * Writes teachers/{uid}/classes/{classId} per the canonical Firestore paths.
 */
export async function createClass(
  db: Firestore,
  uid: string,
  meta: Omit<ClassMeta, 'id'>,
  deps: FirestoreWriteDeps = defaultDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, `teachers/${uid}/classes`);
  const docRef = await addDoc(ref, {
    name: meta.name,
    period: meta.period,
    semester: meta.semester,
    unit: meta.unit,
  });
  return docRef.id;
}
