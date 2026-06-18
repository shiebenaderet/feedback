import { useState } from 'react';
import type { Batch, MessageDraft } from '../types';
import { ReviewScreen, type ReviewMessage } from './ReviewScreen';
import { type CopyPasteMessage } from '../send/CopyPastePanel';
import { SendStepper } from '../send/SendStepper';

export type SendMode = 'A' | 'B';

/** Mode A sender: sends each message, calling onProgress as each resolves. */
export type RunSend = (
  messages: MessageDraft[],
  onProgress: (m: MessageDraft) => void,
) => Promise<MessageDraft[]>;

/** Per-message history sink; fired once per student when their message is sent. */
export type OnSent = (draft: MessageDraft) => Promise<void> | void;

export interface ReviewScreenContainerProps {
  batch: Batch;
  messages: MessageDraft[];
  mode: SendMode;
  runSend: RunSend;
  setBatchStatus: (status: Batch['status']) => Promise<void> | void;
  /** Writes the durable feedbackHistory entry for each sent message. */
  onSent?: OnSent;
  /** Resolves each student's recipient address by studentId. */
  emailById?: Record<string, string>;
  /** Roster students with no message — surfaced as a skipped-student warning. */
  unmessagedNames?: string[];
  /** Shared email subject line; surfaced in copy-paste (Mode B). */
  subject?: string;
}

/** MessageDraft has no email; the container resolves it from a lookup if available. */
function toReviewMessages(
  drafts: MessageDraft[],
  emailById: Record<string, string>,
): ReviewMessage[] {
  return drafts.map((d) => ({
    id: d.studentId,
    name: d.name,
    email: emailById[d.studentId] ?? '',
    finalText: d.finalText,
  }));
}

function toCopyPasteMessages(
  drafts: MessageDraft[],
  sharedHeader: string,
  emailById: Record<string, string>,
): CopyPasteMessage[] {
  return drafts.map((d) => ({
    id: d.studentId,
    name: d.name,
    email: emailById[d.studentId] ?? '',
    finalText: sharedHeader ? `${sharedHeader}\n\n${d.finalText}` : d.finalText,
  }));
}

/**
 * Owns the confirm → send orchestration above the leaf ReviewScreen list.
 * Mode A: setBatchStatus('sending') → runSend (feeding the live progress display)
 * → setBatchStatus('sent'); fires onSent for each message that resolved 'sent'.
 * Mode B: setBatchStatus('sending') → reveal the copy-paste panel; onSent fires
 * from the stepper's mark-sent. runSend/setBatchStatus/onSent/mode are injected
 * so this is testable without Firebase or Gmail.
 */
export function ReviewScreenContainer({
  batch,
  messages,
  mode,
  runSend,
  setBatchStatus,
  onSent,
  emailById = {},
  unmessagedNames = [],
  subject,
}: ReviewScreenContainerProps) {
  const [results, setResults] = useState<MessageDraft[]>(messages);
  const [sending, setSending] = useState(false);
  const [showCopyPaste, setShowCopyPaste] = useState(false);
  const [sentInCopyPaste, setSentInCopyPaste] = useState<Record<string, boolean>>({});

  // Guards against double-writing history for a student already recorded.
  const [historyWritten, setHistoryWritten] = useState<Record<string, boolean>>({});

  function recordHistory(draft: MessageDraft) {
    if (!onSent) return;
    if (historyWritten[draft.studentId]) return;
    setHistoryWritten((prev) => ({ ...prev, [draft.studentId]: true }));
    void onSent(draft);
  }

  async function onConfirm() {
    // (1) Mark the batch in-flight FIRST, regardless of mode.
    await setBatchStatus('sending');

    if (mode === 'B') {
      setShowCopyPaste(true);
      return;
    }

    // Mode A: transmit, updating live results as each message resolves.
    setSending(true);
    const sent = await runSend(messages, (m) => {
      setResults((prev) => prev.map((r) => (r.studentId === m.studentId ? m : r)));
      if (m.status === 'sent') recordHistory(m);
    });
    setResults(sent);
    setSending(false);

    // (3) Only on completion does the batch flip to 'sent'.
    await setBatchStatus('sent');
  }

  function markSent(id: string) {
    const nextSent = { ...sentInCopyPaste, [id]: true };
    setSentInCopyPaste(nextSent);
    const draft = results.find((r) => r.studentId === id);
    if (draft) recordHistory({ ...draft, status: 'sent' });
    // When this was the LAST student, the copy-paste round is complete → flip
    // the batch to 'sent' so it isn't stranded at 'sending' forever.
    if (results.every((r) => nextSent[r.studentId])) {
      void setBatchStatus('sent');
    }
  }

  function markAllSent() {
    setSentInCopyPaste(Object.fromEntries(results.map((r) => [r.studentId, true])));
    for (const r of results) recordHistory({ ...r, status: 'sent' });
    // The whole round went out → mark the batch done (was stuck at 'sending').
    void setBatchStatus('sent');
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const showProgress =
    mode === 'A' && (sending || results.some((r) => r.status !== 'draft'));

  return (
    <div>
      <ReviewScreen
        messages={toReviewMessages(results, emailById)}
        onConfirm={onConfirm}
        unmessagedNames={unmessagedNames}
      />

      {showProgress && (
        <div role="status" aria-label="send progress">
          <span data-testid="progress-sent-count">{sentCount}</span> sent
          {failedCount > 0 && (
            <span data-testid="progress-failed-count"> · {failedCount} failed</span>
          )}
        </div>
      )}

      {mode === 'B' && showCopyPaste && (
        <div data-testid="copy-paste-panel">
          <SendStepper
            messages={toCopyPasteMessages(results, batch.sharedHeader, emailById)}
            sent={sentInCopyPaste}
            onMarkSent={markSent}
            onMarkAllSent={markAllSent}
            subject={subject}
          />
        </div>
      )}
    </div>
  );
}
