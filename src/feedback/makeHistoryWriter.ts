import type { Firestore } from 'firebase/firestore';
import type { BankEntry, MessageDraft } from '../types';
import type { GradingPeriod } from '../feedback/taxonomy';
import {
  writeFeedbackHistory as defaultWriteFeedbackHistory,
  type HistoryTree,
} from '../data/writeFeedbackHistory';

/** A per-message sink the send flow calls after a student's message is sent. */
export type HistorySink = (draft: MessageDraft) => Promise<void>;

export interface MakeHistoryWriterArgs {
  db: Firestore;
  uid: string;
  tree: HistoryTree;
  gradingPeriod: GradingPeriod;
  label: string;
  bankEntries: BankEntry[];
  /** Clock seam; defaults to Date.now. */
  now?: () => number;
  /** Injected for tests; defaults to the real data fn. */
  writeFeedbackHistory?: typeof defaultWriteFeedbackHistory;
  /** Optional failure hook; history writing is best-effort and never blocks send. */
  onError?: (err: unknown, draft: MessageDraft) => void;
}

/**
 * Binds the immutable per-round context (tree ids, grading period, label, bank,
 * clock) into a single-arg sink. The send flow calls the sink once per sent
 * message; each call writes one durable feedbackHistory entry. Failures are
 * swallowed (reported via onError) so a history hiccup never breaks sending.
 */
export function makeHistoryWriter({
  db,
  uid,
  tree,
  gradingPeriod,
  label,
  bankEntries,
  now = Date.now,
  writeFeedbackHistory = defaultWriteFeedbackHistory,
  onError,
}: MakeHistoryWriterArgs): HistorySink {
  return async (draft: MessageDraft) => {
    try {
      await writeFeedbackHistory(db, uid, {
        draft,
        bankEntries,
        tree,
        gradingPeriod,
        label,
        sentAt: now(),
      });
    } catch (err) {
      onError?.(err, draft);
    }
  };
}
