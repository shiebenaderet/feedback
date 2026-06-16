import {
  collection,
  doc,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Batch } from '../types';

/** Fields the caller supplies; id + status are owned by createBatch. */
export type NewBatchInput = Pick<Batch, 'classId' | 'sharedHeader'>;

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
    classId: input.classId,
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
