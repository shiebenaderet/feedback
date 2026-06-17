import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Period } from '../types';
import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';

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

/** A new period: a grading-period label plus its position in the year. */
export interface NewPeriodInput {
  label: string;
  order: number;
}

/**
 * Create ONE period under a course (callers loop over the checked grading
 * periods). The label MUST be one of GRADING_PERIODS — the valid set lives in
 * the taxonomy config, never hardcoded here — so an unknown label is rejected
 * before any write reaches Firestore. Returns the new period id.
 */
export async function createPeriod(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  input: NewPeriodInput,
  deps: PeriodWriteDeps = defaultWriteDeps,
): Promise<string> {
  if (!(GRADING_PERIODS as readonly string[]).includes(input.label)) {
    throw new Error(`Unknown grading period label: ${input.label}`);
  }
  const { collection, addDoc } = deps;
  const ref = collection(db, periodsPath(uid, yearId, courseId));
  const docRef = await addDoc(ref, { label: input.label as GradingPeriod, order: input.order });
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
 * List a course's periods as Period[], sorted ascending by `order` so callers
 * render them in grading-period sequence.
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
