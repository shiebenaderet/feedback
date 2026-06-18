import {
  collectionGroup as fbCollectionGroup,
  getDocs as fbGetDocs,
  query as fbQuery,
  where as fbWhere,
  type Firestore,
} from 'firebase/firestore';
import type { FeedbackHistoryEntry } from '../types';

export interface HistoryGroupReadDeps {
  collectionGroup: typeof fbCollectionGroup;
  getDocs: typeof fbGetDocs;
  query: typeof fbQuery;
  where: typeof fbWhere;
}

const defaultDeps: HistoryGroupReadDeps = {
  collectionGroup: fbCollectionGroup,
  getDocs: fbGetDocs,
  query: fbQuery,
  where: fbWhere,
};

async function readBy(
  db: Firestore,
  field: 'periodId' | 'courseId',
  value: string,
  deps: HistoryGroupReadDeps,
): Promise<FeedbackHistoryEntry[]> {
  const { collectionGroup, getDocs, query, where } = deps;
  const cg = collectionGroup(db, 'feedbackHistory');
  const q = query(cg, where(field, '==', value));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FeedbackHistoryEntry, 'id'>),
  }));
}

/**
 * All feedbackHistory entries for one period, across every student.
 * Uses a collection-group query so it spans the per-student subcollections;
 * the security rules confine this to the signed-in teacher's own uid tree
 * (cross-tenant isolation), so the group query can only ever return their docs.
 * `uid` is accepted for call-site symmetry and future per-uid scoping.
 */
export async function listPeriodHistory(
  db: Firestore,
  _uid: string,
  periodId: string,
  deps: HistoryGroupReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  return readBy(db, 'periodId', periodId, deps);
}

/** Course rollup: every entry under a course, across all its periods. */
export async function listCourseHistory(
  db: Firestore,
  _uid: string,
  courseId: string,
  deps: HistoryGroupReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  return readBy(db, 'courseId', courseId, deps);
}
