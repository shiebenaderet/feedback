import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Student } from '../types';

/**
 * CORRECTED PATH for the redesign — students live deep under their period:
 *   teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}
 * (the old classId-based path in saveStudents.ts/listStudents.ts is superseded).
 */
const studentsPath = (
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students`;

/** Injectable Firestore primitives for student writes. */
export interface StudentWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: StudentWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/** Persist imported students under their period. Returns the count written. */
export async function saveStudents(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  students: Student[],
  deps: StudentWriteDeps = defaultWriteDeps,
): Promise<number> {
  const { collection, addDoc } = deps;
  const ref = collection(db, studentsPath(uid, yearId, courseId, periodId));
  for (const s of students) {
    await addDoc(ref, { name: s.name, email: s.email, period: s.period });
  }
  return students.length;
}

/** Injectable Firestore primitives for student reads. */
export interface StudentReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultReadDeps: StudentReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/** Load a period's students as Student[]. Omits `period` when absent. */
export async function listStudents(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  deps: StudentReadDeps = defaultReadDeps,
): Promise<Student[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(collection(db, studentsPath(uid, yearId, courseId, periodId)));
  return snap.docs.map((d) => {
    const data = d.data() as { name: string; email: string; period?: string };
    const student: Student = { id: d.id, name: data.name, email: data.email };
    if (data.period !== undefined) student.period = data.period;
    return student;
  });
}


/** Same email shape the roster importer validates with (src/roster/parseRoster.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Editable subset of a student. */
export type StudentPatch = Partial<Pick<Student, 'name' | 'email' | 'period'>>;

const studentDocPath = (
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  studentId: string,
) => `${studentsPath(uid, yearId, courseId, periodId)}/${studentId}`;

/** Injectable Firestore primitives for a student update. */
export interface StudentUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

const defaultUpdateDeps: StudentUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

/**
 * Patch a single student at the nested period path. Re-validates email when the
 * patch includes one; an invalid email is rejected before any write reaches
 * Firestore.
 */
export async function updateStudent(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  studentId: string,
  patch: StudentPatch,
  deps: StudentUpdateDeps = defaultUpdateDeps,
): Promise<void> {
  if (patch.email !== undefined && !EMAIL_RE.test(patch.email)) {
    throw new Error(`Invalid email: ${patch.email}`);
  }
  const { doc, updateDoc } = deps;
  const ref = doc(db, studentDocPath(uid, yearId, courseId, periodId, studentId));
  await updateDoc(ref, { ...patch });
}

/** Injectable Firestore primitives for a student delete. */
export interface StudentDeleteDeps {
  doc: typeof fbDoc;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeleteDeps: StudentDeleteDeps = {
  doc: fbDoc,
  deleteDoc: fbDeleteDoc,
};

/** Remove a single student at the nested period path. */
export async function deleteStudent(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  studentId: string,
  deps: StudentDeleteDeps = defaultDeleteDeps,
): Promise<void> {
  const { doc, deleteDoc } = deps;
  await deleteDoc(doc(db, studentDocPath(uid, yearId, courseId, periodId, studentId)));
}


/** Convenience: the number of students in a period (Home's per-period count). */
export async function rosterSize(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
): Promise<number> {
  const students = await listStudents(db, uid, yearId, courseId, periodId);
  return students.length;
}
