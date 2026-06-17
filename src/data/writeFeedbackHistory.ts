import {
  doc as fbDoc,
  setDoc as fbSetDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BankEntry, FeedbackHistoryEntry, MessageDraft } from '../types';
import type { GradingPeriod } from '../feedback/taxonomy';
import { deriveHistoryTags } from '../feedback/deriveHistoryTags';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreWriteDeps {
  doc: typeof fbDoc;
  setDoc: typeof fbSetDoc;
}
const defaultDeps: FirestoreWriteDeps = {
  doc: fbDoc,
  setDoc: fbSetDoc,
};

/** Location of the student in the year→course→period tree. */
export interface HistoryTree {
  yearId: string;
  courseId: string;
  periodId: string;
}

export interface WriteFeedbackHistoryArgs {
  /** The message as it was actually sent (status 'sent'). */
  draft: MessageDraft;
  /** The full bank (or at least the used entries), for tag derivation. */
  bankEntries: BankEntry[];
  tree: HistoryTree;
  gradingPeriod: GradingPeriod;
  /** Optional free-text label for the round; omitted from the doc when empty. */
  label: string;
  /** Timestamp (ms) the round went out; injected for deterministic tests. */
  sentAt: number;
  /**
   * The batch (round) this send belongs to. Combined with the studentId it forms
   * the DETERMINISTIC history doc id `{batchId}__{studentId}`, so re-sending /
   * refreshing / reopening the same round OVERWRITES the entry in place instead
   * of appending a duplicate (which would double-count every trend).
   */
  batchId: string;
}

/**
 * Write the DURABLE per-student feedback record. Independent of the batch:
 * called once per student on send / mark-sent. Derives structured tags from the
 * USED bank entries (taxonomy-driven) while storing the raw usedEntries ids so
 * trends are re-derivable under a future mapping.
 *
 * Path: teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}
 *       /students/{studentId}/feedbackHistory/{batchId}__{studentId}
 *
 * Idempotent per (batch, student): a repeat write overwrites in place.
 * Returns the history entry id.
 */
export async function writeFeedbackHistory(
  db: Firestore,
  uid: string,
  args: WriteFeedbackHistoryArgs,
  deps: FirestoreWriteDeps = defaultDeps,
): Promise<string> {
  const { doc, setDoc } = deps;
  const { draft, bankEntries, tree, gradingPeriod, label, sentAt, batchId } = args;

  const byId = new Map(bankEntries.map((e) => [e.id, e]));
  const resolved = draft.usedEntries
    .map((id) => byId.get(id))
    .filter((e): e is BankEntry => !!e);

  const tags = deriveHistoryTags(resolved);

  const path = `teachers/${uid}/years/${tree.yearId}/courses/${tree.courseId}/periods/${tree.periodId}/students/${draft.studentId}/feedbackHistory`;

  const entry: FeedbackHistoryEntry = {
    // ownerUid is required by the trends collectionGroup query
    // (where('ownerUid','==',uid)) — without it, trends/history read back empty.
    ownerUid: uid,
    studentId: draft.studentId,
    periodId: tree.periodId,
    courseId: tree.courseId,
    yearId: tree.yearId,
    sentAt,
    gradingPeriod,
    finalText: draft.finalText,
    tags,
    // Raw ids for traceability + reclassification (keep the unresolvable ones too).
    usedEntries: draft.usedEntries,
  };
  if (label) entry.label = label;

  // Deterministic id keyed by the round → idempotent re-writes (no duplicates).
  const entryId = `${batchId}__${draft.studentId}`;
  await setDoc(doc(db, path, entryId), entry);
  return entryId;
}
