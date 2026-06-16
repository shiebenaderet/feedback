import { useCallback, useEffect, useRef } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';
import { saveMessageDraft } from '../firebase/messages';

/** A debounced saver: call it with a MessageDraft, it persists after `delayMs` idle. */
export type DebouncedSave = (draft: MessageDraft) => void;

/**
 * Returns a debounced function that persists a MessageDraft to the given batch
 * via saveMessageDraft. Wires Compose auto-save to a REAL batchId (from createBatch).
 *
 * No vestigial `_value` param — the debounced fn accepts exactly one argument,
 * the MessageDraft to persist.
 */
export function useDebouncedSave(
  db: Firestore,
  uid: string,
  batchId: string,
  delayMs = 800,
): DebouncedSave {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<MessageDraft | null>(null);

  // Cancel any in-flight timer on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return useCallback(
    (draft: MessageDraft) => {
      pending.current = draft;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const latest = pending.current;
        if (latest) {
          void saveMessageDraft(db, uid, batchId, latest);
        }
      }, delayMs);
    },
    [db, uid, batchId, delayMs],
  );
}
