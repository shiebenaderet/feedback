import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  doc as fbDoc,
  setDoc as fbSetDoc,
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
  doc: typeof fbDoc;
  setDoc: typeof fbSetDoc;
}

const defaultWriteDeps: StudentWriteDeps = {
  doc: fbDoc,
  setDoc: fbSetDoc,
};

/**
 * A stable Firestore doc id derived from the student's email, so the SAME
 * student always lands on the SAME doc — re-importing a roster updates in place
 * instead of duplicating. Email is normalized (trim + lowercase) and sanitized
 * to the chars Firestore allows in a doc id ('/' and a few specials are out).
 */
export function studentDocIdFromEmail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[/\\.#$[\]]/g, '_');
}

/**
 * Persist a period's students as an UPSERT keyed by email: each student is
 * written at a deterministic email-derived id with merge, so re-importing the
 * same CSV (or double-clicking Confirm) updates rather than duplicates. Students
 * with no usable email are skipped (they'd otherwise mint an unkeyed duplicate).
 * Returns the count actually written.
 */
export async function saveStudents(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  students: Student[],
  deps: StudentWriteDeps = defaultWriteDeps,
): Promise<number> {
  const { doc, setDoc } = deps;
  const path = studentsPath(uid, yearId, courseId, periodId);
  let written = 0;
  for (const s of students) {
    const key = studentDocIdFromEmail(s.email ?? '');
    if (key === '') continue; // no email → skip rather than create an unkeyed dupe
    await setDoc(doc(db, path, key), { name: s.name, email: s.email, period: s.period }, { merge: true });
    written += 1;
  }
  return written;
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
