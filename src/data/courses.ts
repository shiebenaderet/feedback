import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Course } from '../types';

const coursesPath = (uid: string, yearId: string) =>
  `teachers/${uid}/years/${yearId}/courses`;

/** Injectable Firestore primitives for course writes. */
export interface CourseWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: CourseWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Create a course under teachers/{uid}/years/{yearId}/courses and return its id.
 */
export async function createCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  name: string,
  deps: CourseWriteDeps = defaultWriteDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, coursesPath(uid, yearId));
  const docRef = await addDoc(ref, { name });
  return docRef.id;
}

/** Injectable Firestore primitives for course reads. */
export interface CourseReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultReadDeps: CourseReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/** Defaults to active-only (archived hidden). */
export interface ListCoursesOptions {
  includeArchived?: boolean;
}

/**
 * List a year's courses. By default archived courses (archived === true) are
 * filtered out; pass { includeArchived: true } for the full set.
 */
export async function listCourses(
  db: Firestore,
  uid: string,
  yearId: string,
  deps: CourseReadDeps = defaultReadDeps,
  options: ListCoursesOptions = {},
): Promise<Course[]> {
  const { collection, getDocs } = deps;
  const { includeArchived = false } = options;
  const snap = await getDocs(collection(db, coursesPath(uid, yearId)));
  const courses = snap.docs.map((d) => {
    const data = d.data() as Omit<Course, 'id'>;
    const course: Course = { id: d.id, name: data.name };
    if (data.archived !== undefined) course.archived = data.archived;
    return course;
  });
  return includeArchived ? courses : courses.filter((c) => c.archived !== true);
}
