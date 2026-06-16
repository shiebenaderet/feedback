import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';

/**
 * Persists one student's in-progress message draft to
 * teachers/{uid}/batches/{batchId}/messages/{studentId}.
 *
 * Keyed by draft.studentId so each student has exactly one record per batch:
 * this same doc is the "save my work" draft, the thing that gets sent, and the
 * future history entry. setDoc (no merge) makes auto-save idempotent — re-saving
 * the full MessageDraft overwrites in place.
 *
 * `db` is injected for testability (emulator in tests, app db in prod).
 */
export async function saveMessageDraft(
  db: Firestore,
  uid: string,
  batchId: string,
  draft: MessageDraft,
): Promise<void> {
  const ref = doc(
    db,
    `teachers/${uid}/batches/${batchId}/messages/${draft.studentId}`,
  );
  await setDoc(ref, draft);
}
