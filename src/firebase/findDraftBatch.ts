import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  query as fbQuery,
  where as fbWhere,
  orderBy as fbOrderBy,
  documentId as fbDocumentId,
  type Firestore,
} from 'firebase/firestore';
import type { Batch } from '../types';

export interface FindDraftBatchDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
  query: typeof fbQuery;
  where: typeof fbWhere;
  orderBy: typeof fbOrderBy;
  documentId: typeof fbDocumentId;
}

const defaultDeps: FindDraftBatchDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
  query: fbQuery,
  where: fbWhere,
  orderBy: fbOrderBy,
  documentId: fbDocumentId,
};

/**
 * Finds an existing OPEN (draft) batch for a period so the compose screen can
 * RESUME it across page reloads instead of orphaning the prior draft. Returns
 * the first matching draft batch, or null if none exists yet.
 */
export async function findDraftBatch(
  db: Firestore,
  uid: string,
  periodId: string,
  deps: FindDraftBatchDeps = defaultDeps,
): Promise<Batch | null> {
  const { collection, getDocs, query, where, orderBy, documentId } = deps;
  // orderBy(documentId()) makes the choice DETERMINISTIC: if two draft batches
  // ever exist for one period (a concurrent first-create race), every session
  // resolves to the same one (smallest id) instead of an arbitrary doc.
  const q = query(
    collection(db, `teachers/${uid}/batches`),
    where('periodId', '==', periodId),
    where('status', '==', 'draft'),
    orderBy(documentId()),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  return first ? (first.data() as Batch) : null;
}
