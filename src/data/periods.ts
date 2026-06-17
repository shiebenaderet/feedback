import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Period } from '../types';

const periodsPath = (uid: string, yearId: string, courseId: string) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`;

/** Injectable Firestore primitives for period writes. */
export interface PeriodWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: PeriodWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/** A new class period: a free-form label ("Period 1", "Block A") plus its order. */
export interface NewPeriodInput {
  label: string;
  order: number;
}

/**
 * Create ONE class period under a course (callers loop over the checked
 * periods). A class period is a timetable section — "Period 1", "Block A",
 * "1st hour" — so its label is free-form user text, NOT a fixed vocabulary.
 * (Grading periods like Q1/Q2 are a separate axis chosen per send batch.)
 * Returns the new period id.
 */
export async function createPeriod(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  input: NewPeriodInput,
  deps: PeriodWriteDeps = defaultWriteDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, periodsPath(uid, yearId, courseId));
  const docRef = await addDoc(ref, { label: input.label, order: input.order });
  return docRef.id;
}

/** Injectable Firestore primitives for period reads. */
export interface PeriodReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultReadDeps: PeriodReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/**
 * List a course's class periods as Period[], sorted ascending by `order` so
 * callers render them in timetable sequence.
 */
export async function listPeriods(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: PeriodReadDeps = defaultReadDeps,
): Promise<Period[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(collection(db, periodsPath(uid, yearId, courseId)));
  const periods = snap.docs.map((d) => {
    const data = d.data() as Omit<Period, 'id'>;
    return { id: d.id, label: data.label, order: data.order };
  });
  return periods.sort((a, b) => a.order - b.order);
}
