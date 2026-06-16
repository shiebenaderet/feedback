// src/review/SendPanel.tsx
import { useState } from 'react';
import type { Batch } from '../types';

export interface SendPanelProps {
  batch: Batch;
  onSend: () => void;
  // Invoked only after the explicit "Send again" → confirm. The CONTAINER (Task S20)
  // wires this to: setBatchStatus(db, uid, batch.id, 'sending') then runSend(...).
  // The panel stays pure UI — no Firebase import, no setBatchStatus call here
  // (Reconciliation rule 1: setBatchStatus is the 4-arg fn owned by Task C21).
  onResend: () => void;
}

/**
 * Review-screen send panel. Reads Batch.status to prevent accidental
 * double-sends: a `sent` batch disables the primary Send action, and re-sending
 * is gated behind an explicit "Send again" + confirm before invoking onResend.
 */
export function SendPanel({ batch, onSend, onResend }: SendPanelProps) {
  const alreadySent = batch.status === 'sent';
  const [confirming, setConfirming] = useState(false);

  const handleResendConfirmed = () => {
    setConfirming(false);
    onResend();
  };

  return (
    <div>
      <button type="button" onClick={onSend} disabled={alreadySent}>
        Send all
      </button>

      {alreadySent && (
        <div role="status">
          <p>This batch has already been sent.</p>
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)}>
              Send again
            </button>
          ) : (
            <>
              <p>Re-send to every recipient in this batch?</p>
              <button type="button" onClick={handleResendConfirmed}>
                Yes, re-send
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
