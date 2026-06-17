import {
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { ClassMeta } from '../types';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

export const defaultUpdateDeps: FirestoreUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

/** The editable metadata fields of a class. */
export type ClassRenamePatch = Partial<
  Pick<ClassMeta, 'name' | 'period' | 'semester' | 'unit'>
>;

/**
 * Update a class's metadata at teachers/{uid}/classes/{classId} via updateDoc,
 * touching ONLY the keys present in `patch`. Keys whose value is undefined are
 * stripped so a partial patch never overwrites a sibling field with undefined.
 */
export async function renameClass(
  db: Firestore,
  uid: string,
  classId: string,
  patch: ClassRenamePatch,
  deps: FirestoreUpdateDeps = defaultUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  const clean: ClassRenamePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (clean as Record<string, unknown>)[key] = value;
    }
  }
  await updateDoc(doc(db, `teachers/${uid}/classes/${classId}`), clean);
}
