import {
  collection as fbCollection,
  doc as fbDoc,
  getDocs as fbGetDocs,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseDeleteDeps {
  collection: typeof fbCollection;
  doc: typeof fbDoc;
  getDocs: typeof fbGetDocs;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeps: CourseDeleteDeps = {
  collection: fbCollection,
  doc: fbDoc,
  getDocs: fbGetDocs,
  deleteDoc: fbDeleteDoc,
};

/**
 * DESTRUCTIVE. Permanently deletes a course and ALL data nested under it:
 *   periods/{pId}/students/{sId}/feedbackHistory/{fId}
 * The Firestore client SDK has no recursive delete, so we walk the tree and
 * delete deepest-first — every feedbackHistory entry, then each student, then
 * each period, then the course doc LAST — so an interrupted run never orphans
 * children behind a missing parent. There is no undo; callers must confirm
 * with the user first. To merely hide a course, use archiveCourse instead.
 */
export async function deleteCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: CourseDeleteDeps = defaultDeps,
): Promise<void> {
  const { collection, doc, getDocs, deleteDoc } = deps;
  const coursePath = `teachers/${uid}/years/${yearId}/courses/${courseId}`;

  const periodsSnap = await getDocs(collection(db, `${coursePath}/periods`));
  for (const period of periodsSnap.docs) {
    const periodPath = `${coursePath}/periods/${period.id}`;

    const studentsSnap = await getDocs(collection(db, `${periodPath}/students`));
    for (const student of studentsSnap.docs) {
      const studentPath = `${periodPath}/students/${student.id}`;

      // Deepest level first: feedbackHistory entries.
      const historySnap = await getDocs(collection(db, `${studentPath}/feedbackHistory`));
      for (const entry of historySnap.docs) {
        await deleteDoc(doc(db, `${studentPath}/feedbackHistory/${entry.id}`));
      }

      // Then the student doc.
      await deleteDoc(doc(db, studentPath));
    }

    // Then the period doc.
    await deleteDoc(doc(db, periodPath));
  }

  // The course doc LAST.
  await deleteDoc(doc(db, coursePath));
}
