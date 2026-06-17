import {
  collection as fbCollection,
  collectionGroup as fbCollectionGroup,
  getDocs as fbGetDocs,
  query as fbQuery,
  where as fbWhere,
  type Firestore,
} from 'firebase/firestore';
import type { FeedbackHistoryEntry } from '../types';

/** Scope a history query to a student, a period, a course, or a whole year. */
export interface HistoryScope {
  yearId: string;
  courseId?: string;
  periodId?: string;
  studentId?: string;
}

export interface FeedbackHistoryReadDeps {
  collection: typeof fbCollection;
  collectionGroup: typeof fbCollectionGroup;
  getDocs: typeof fbGetDocs;
  query: typeof fbQuery;
  where: typeof fbWhere;
}

const defaultDeps: FeedbackHistoryReadDeps = {
  collection: fbCollection,
  collectionGroup: fbCollectionGroup,
  getDocs: fbGetDocs,
  query: fbQuery,
  where: fbWhere,
};

/**
 * Read FeedbackHistoryEntry[] for a scope. Entries are denormalized with
 * yearId/courseId/periodId/studentId, so a collectionGroup query over
 * `feedbackHistory` filtered by the provided scope ids returns the matching set
 * (per-student, per-period, per-course, or whole-year). `db`/primitives are
 * injectable for testability.
 */
export async function listFeedbackHistory(
  db: Firestore,
  uid: string,
  scope: HistoryScope,
  deps: FeedbackHistoryReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  const { collectionGroup, getDocs, query, where } = deps;
  const constraints = [
    where('ownerUid', '==', uid),
    where('yearId', '==', scope.yearId),
  ];
  if (scope.courseId) constraints.push(where('courseId', '==', scope.courseId));
  if (scope.periodId) constraints.push(where('periodId', '==', scope.periodId));
  if (scope.studentId) constraints.push(where('studentId', '==', scope.studentId));

  const snap = await getDocs(query(collectionGroup(db, 'feedbackHistory'), ...constraints));
  return snap.docs.map((d) => d.data() as FeedbackHistoryEntry);
}
