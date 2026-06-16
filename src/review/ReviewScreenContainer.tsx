import { useState } from 'react';
import type { Batch, MessageDraft } from '../types';
import { ReviewScreen, type ReviewMessage } from './ReviewScreen';
import { CopyPastePanel, type CopyPasteMessage } from '../send/CopyPastePanel';

export type SendMode = 'A' | 'B';

/** Mode A sender: sends each message, calling onProgress as each resolves. */
export type RunSend = (
  messages: MessageDraft[],
  onProgress: (m: MessageDraft) => void,
) => Promise<MessageDraft[]>;

export interface ReviewScreenContainerProps {
  batch: Batch;
  messages: MessageDraft[];
  mode: SendMode;
  runSend: RunSend;
  setBatchStatus: (status: Batch['status']) => Promise<void> | void;
}

/** MessageDraft has no email; the container resolves it from a lookup if available. */
function toReviewMessages(drafts: MessageDraft[]): ReviewMessage[] {
  return drafts.map((d) => ({
    id: d.studentId,
    name: d.name,
    email: '',
    finalText: d.finalText,
  }));
}

function toCopyPasteMessages(
  drafts: MessageDraft[],
  sharedHeader: string,
): CopyPasteMessage[] {
  return drafts.map((d) => ({
    id: d.studentId,
    name: d.name,
    email: '',
    finalText: sharedHeader ? `${sharedHeader}\n\n${d.finalText}` : d.finalText,
  }));
}

/**
 * Owns the confirm → send orchestration above the leaf ReviewScreen list.
 * Mode A: setBatchStatus('sending') → runSend (feeding the live progress display)
 * → setBatchStatus('sent'). Mode B: setBatchStatus('sending') → reveal the
 * copy-paste panel; runSend is never called. runSend/setBatchStatus/mode are
 * injected props so this is testable without Firebase or Gmail.
 */
export function ReviewScreenContainer({
  batch,
  messages,
  mode,
  runSend,
  setBatchStatus,
}: ReviewScreenContainerProps) {
  const [results, setResults] = useState<MessageDraft[]>(messages);
  const [sending, setSending] = useState(false);
  const [showCopyPaste, setShowCopyPaste] = useState(false);
  const [sentInCopyPaste, setSentInCopyPaste] = useState<Record<string, boolean>>({});

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
      setResults((prev) =>
        prev.map((r) => (r.studentId === m.studentId ? m : r)),
      );
    });
    setResults(sent);
    setSending(false);

    // (3) Only on completion does the batch flip to 'sent'.
    await setBatchStatus('sent');
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const showProgress =
    mode === 'A' && (sending || results.some((r) => r.status !== 'draft'));

  return (
    <div>
      <ReviewScreen messages={toReviewMessages(results)} onConfirm={onConfirm} />

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
          <CopyPastePanel
            messages={toCopyPasteMessages(results, batch.sharedHeader)}
            sent={sentInCopyPaste}
            onMarkSent={(id) =>
              setSentInCopyPaste((prev) => ({ ...prev, [id]: true }))
            }
            onMarkAllSent={() =>
              setSentInCopyPaste(
                Object.fromEntries(results.map((r) => [r.studentId, true])),
              )
            }
          />
        </div>
      )}

      <button type="button" onClick={onConfirm}>
        Send all
      </button>
    </div>
  );
}
