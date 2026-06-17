import {
  collection,
  doc,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Batch } from '../types';

/** Fields the caller supplies; id + status are owned by createBatch. */
export type NewBatchInput = Pick<Batch, 'yearId' | 'courseId' | 'periodId' | 'sharedHeader'>;

/**
 * Creates a draft batch at teachers/{uid}/batches/{batchId}.
 * Returns the generated batchId. `db` is passed in for testability.
 */
export async function createBatch(
  db: Firestore,
  uid: string,
  input: NewBatchInput,
): Promise<string> {
  const ref = doc(collection(db, `teachers/${uid}/batches`));
  const batch: Batch = {
    id: ref.id,
    yearId: input.yearId,
    courseId: input.courseId,
    periodId: input.periodId,
    sharedHeader: input.sharedHeader,
    status: 'draft',
  };
  await setDoc(ref, batch);
  return ref.id;
}

/** Advances a batch through its lifecycle: 'sending' | 'sent'. */
export async function setBatchStatus(
  db: Firestore,
  uid: string,
  batchId: string,
  status: Extract<Batch['status'], 'sending' | 'sent'>,
): Promise<void> {
  await updateDoc(doc(db, `teachers/${uid}/batches/${batchId}`), { status });
}

import {
  doc as fbDoc,
  getDoc as fbGetDoc,
} from 'firebase/firestore';

export interface BatchReadDeps {
  doc: typeof fbDoc;
  getDoc: typeof fbGetDoc;
}
const defaultBatchReadDeps: BatchReadDeps = { doc: fbDoc, getDoc: fbGetDoc };

/** Reads a single batch by id; returns null when the doc does not exist. */
export async function getBatch(
  db: Firestore,
  uid: string,
  batchId: string,
  deps: BatchReadDeps = defaultBatchReadDeps,
): Promise<Batch | null> {
  const { doc, getDoc } = deps;
  const snap = await getDoc(doc(db, `teachers/${uid}/batches/${batchId}`));
  if (!snap.exists()) return null;
  return snap.data() as Batch;
}


/** Updates editable batch fields: shared header and the grading-period stamp. */
export async function updateBatch(
  db: Firestore,
  uid: string,
  batchId: string,
  patch: Partial<Pick<Batch, 'sharedHeader' | 'gradingPeriod' | 'label'>>,
): Promise<void> {
  await updateDoc(doc(db, `teachers/${uid}/batches/${batchId}`), patch);
}
