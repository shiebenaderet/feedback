import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  orderBy as fbOrderBy,
  query as fbQuery,
  type Firestore,
} from 'firebase/firestore';
import type { FeedbackHistoryEntry } from '../types';

export interface StudentLocation {
  yearId: string;
  courseId: string;
  periodId: string;
  studentId: string;
}

export interface HistoryReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
  orderBy: typeof fbOrderBy;
  query: typeof fbQuery;
}

const defaultDeps: HistoryReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
  orderBy: fbOrderBy,
  query: fbQuery,
};

/** Path to one student's feedbackHistory subcollection under the new taxonomy paths. */
export function studentHistoryPath(uid: string, loc: StudentLocation): string {
  return `teachers/${uid}/years/${loc.yearId}/courses/${loc.courseId}/periods/${loc.periodId}/students/${loc.studentId}/feedbackHistory`;
}

/**
 * Reads one student's feedbackHistory entries, newest first.
 * Maps each doc id onto FeedbackHistoryEntry.id so callers have a stable key.
 */
export async function listStudentHistory(
  db: Firestore,
  uid: string,
  loc: StudentLocation,
  deps: HistoryReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  const { collection, getDocs, orderBy, query } = deps;
  const coll = collection(db, studentHistoryPath(uid, loc));
  const q = query(coll, orderBy('sentAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FeedbackHistoryEntry, 'id'>),
  }));
}
