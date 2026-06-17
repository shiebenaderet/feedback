import {
  collection as fbCollection,
  doc as fbDoc,
  getDocs as fbGetDocs,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreDeleteDeps {
  collection: typeof fbCollection;
  doc: typeof fbDoc;
  getDocs: typeof fbGetDocs;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeps: FirestoreDeleteDeps = {
  collection: fbCollection,
  doc: fbDoc,
  getDocs: fbGetDocs,
  deleteDoc: fbDeleteDoc,
};

/**
 * Subcollections nested directly under a class doc that this helper sweeps.
 * Documented as a const so the destructive surface is explicit and reviewable;
 * `students` is the only one nested under classes/{classId} today (see
 * saveStudents.ts / listStudents.ts). Extend this list if a class ever owns
 * more nested collections.
 */
export const KNOWN_CLASS_SUBCOLLECTIONS = ['students'] as const;

/**
 * DESTRUCTIVE. Permanently deletes a class and ALL data nested under it:
 * every doc in each known subcollection (currently `students`) is removed
 * first, then the class doc itself is deleted LAST so an interrupted run never
 * orphans children behind a missing parent.
 *
 * The Firestore client SDK has no recursive delete, so we enumerate each known
 * subcollection with getDocs and deleteDoc every child by id. There is no undo —
 * callers must confirm with the user before invoking. To merely hide a class,
 * use archiveClass instead.
 */
export async function deleteClass(
  db: Firestore,
  uid: string,
  classId: string,
  deps: FirestoreDeleteDeps = defaultDeps,
): Promise<void> {
  const { collection, doc, getDocs, deleteDoc } = deps;
  const classPath = `teachers/${uid}/classes/${classId}`;

  // 1) Delete each child in every known subcollection FIRST.
  for (const sub of KNOWN_CLASS_SUBCOLLECTIONS) {
    const subPath = `${classPath}/${sub}`;
    const snap = await getDocs(collection(db, subPath));
    for (const child of snap.docs) {
      await deleteDoc(doc(db, `${subPath}/${child.id}`));
    }
  }

  // 2) Delete the class doc LAST.
  await deleteDoc(doc(db, classPath));
}
