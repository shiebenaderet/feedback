import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  query as fbQuery,
  where as fbWhere,
  type Firestore,
} from 'firebase/firestore';
import type { Batch } from '../types';

export interface FindDraftBatchDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
  query: typeof fbQuery;
  where: typeof fbWhere;
}

const defaultDeps: FindDraftBatchDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
  query: fbQuery,
  where: fbWhere,
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
  const { collection, getDocs, query, where } = deps;
  const q = query(
    collection(db, `teachers/${uid}/batches`),
    where('periodId', '==', periodId),
    where('status', '==', 'draft'),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  return first ? (first.data() as Batch) : null;
}
