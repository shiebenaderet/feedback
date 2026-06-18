import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  doc as fbDoc,
  getDoc as fbGetDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Assignment } from '../types';

const assignmentsPath = (uid: string, yearId: string, courseId: string) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}/assignments`;

/** Fields the caller supplies on create; id/createdAt are generated here. */
export type NewAssignmentInput = {
  title: string;
  standardCodes: string[];
  summative: boolean;
  periodIds: string[];
};

export interface AssignmentWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
  now: () => number;
}
const defaultWriteDeps: AssignmentWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
  now: Date.now,
};

/** Create an assignment under a course; returns its id. */
export async function createAssignment(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  input: NewAssignmentInput,
  deps: AssignmentWriteDeps = defaultWriteDeps,
): Promise<string> {
  const { collection, addDoc, now } = deps;
  const ref = collection(db, assignmentsPath(uid, yearId, courseId));
  const docRef = await addDoc(ref, {
    title: input.title,
    standardCodes: input.standardCodes,
    summative: input.summative,
    periodIds: input.periodIds,
    createdAt: now(),
  });
  return docRef.id;
}

export interface AssignmentReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
  doc: typeof fbDoc;
  getDoc: typeof fbGetDoc;
}
const defaultReadDeps: AssignmentReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
  doc: fbDoc,
  getDoc: fbGetDoc,
};

function toAssignment(
  id: string,
  yearId: string,
  courseId: string,
  data: Record<string, unknown>,
): Assignment {
  return {
    id,
    yearId,
    courseId,
    title: (data.title as string) ?? '',
    standardCodes: (data.standardCodes as string[]) ?? [],
    summative: (data.summative as boolean) ?? false,
    periodIds: (data.periodIds as string[]) ?? [],
    canvasAssignmentId: data.canvasAssignmentId as string | undefined,
    createdAt: (data.createdAt as number) ?? 0,
  };
}

/** List a course's assignments, newest first. */
export async function listAssignments(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: AssignmentReadDeps = defaultReadDeps,
): Promise<Assignment[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(collection(db, assignmentsPath(uid, yearId, courseId)));
  const items = snap.docs.map((d) =>
    toAssignment(d.id, yearId, courseId, d.data() as Record<string, unknown>),
  );
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

/** Read a single assignment by id; null when missing. */
export async function getAssignment(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  assignmentId: string,
  deps: AssignmentReadDeps = defaultReadDeps,
): Promise<Assignment | null> {
  const { doc, getDoc } = deps;
  const snap = await getDoc(
    doc(db, assignmentsPath(uid, yearId, courseId), assignmentId),
  );
  if (!snap.exists()) return null;
  return toAssignment(snap.id, yearId, courseId, snap.data() as Record<string, unknown>);
}

export interface AssignmentUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}
const defaultUpdateDeps: AssignmentUpdateDeps = { doc: fbDoc, updateDoc: fbUpdateDoc };

/** Update editable assignment fields. */
export async function updateAssignment(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  assignmentId: string,
  patch: Partial<Pick<Assignment, 'title' | 'standardCodes' | 'summative' | 'periodIds' | 'canvasAssignmentId'>>,
  deps: AssignmentUpdateDeps = defaultUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, assignmentsPath(uid, yearId, courseId), assignmentId), patch);
}

export interface AssignmentDeleteDeps {
  doc: typeof fbDoc;
  deleteDoc: typeof fbDeleteDoc;
}
const defaultDeleteDeps: AssignmentDeleteDeps = { doc: fbDoc, deleteDoc: fbDeleteDoc };

/** Delete an assignment. */
export async function deleteAssignment(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  assignmentId: string,
  deps: AssignmentDeleteDeps = defaultDeleteDeps,
): Promise<void> {
  const { doc, deleteDoc } = deps;
  await deleteDoc(doc(db, assignmentsPath(uid, yearId, courseId), assignmentId));
}
