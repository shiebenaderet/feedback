import { type Firestore } from 'firebase/firestore';
import {
  type FirestoreUpdateDeps,
  defaultUpdateDeps,
} from './renameClass';

/**
 * Set (or clear) the archived flag on a class at
 * teachers/{uid}/classes/{classId}. Archived classes are hidden from the
 * default class list (see listClasses) but never deleted — call with `false`
 * to restore. Non-destructive.
 */
export async function archiveClass(
  db: Firestore,
  uid: string,
  classId: string,
  archived: boolean,
  deps: FirestoreUpdateDeps = defaultUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, `teachers/${uid}/classes/${classId}`), { archived });
}
