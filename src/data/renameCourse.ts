import {
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

export const defaultCourseUpdateDeps: CourseUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

const coursePath = (uid: string, yearId: string, courseId: string) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}`;

/** Rename a course (its `name` field) at the nested course path. */
export async function renameCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  name: string,
  deps: CourseUpdateDeps = defaultCourseUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, coursePath(uid, yearId, courseId)), { name });
}

/**
 * Set (or clear) the archived flag on a course. Archived courses are hidden
 * from listCourses by default but never deleted — call with `false` to restore.
 * Non-destructive.
 */
export async function archiveCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  archived: boolean,
  deps: CourseUpdateDeps = defaultCourseUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, coursePath(uid, yearId, courseId)), { archived });
}
