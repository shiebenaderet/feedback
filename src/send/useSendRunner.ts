// src/send/useSendRunner.ts
import { useState, useCallback, useRef } from 'react';
import type { MessageDraft } from '../types';
import { signInWithGoogle } from '../auth/authService';   // F4 — the real sign-in (Reconciliation rule 1)
import { isAuthError } from './isAuthError';

// The Gmail send function (from createGmailSender, Task S6). Injected so prod
// passes the real sender and tests pass a mock. Adapts MessageDraft → the call
// shape the S6 sender expects. The recipient email is NOT on MessageDraft (it
// lives on the roster); production passes an `emailFor` lookup so the sender can
// resolve it, and the test's mock ignores it.
export type SendFn = (msg: { id: string; email: string; finalText: string }) => Promise<{ id: string }>;

/** Optional studentId → email resolver; defaults to '' (the real sender supplies it). */
export type EmailLookup = (studentId: string) => string;

export interface SendRunner {
  messages: MessageDraft[];
  failures: MessageDraft[];
  needsReauth: boolean;
  done: boolean;
  sending: boolean;
  start: () => Promise<void>;
  reauthorizeAndRetry: () => Promise<void>;
}

/**
 * Batch-send state machine (Mode A). Sends one message at a time; marks each
 * `sent`/`failed` individually. A per-message failure NEVER halts the batch.
 * An AUTH error (isAuthError) DOES halt: it sets `needsReauth` and leaves the
 * remaining messages as `draft` so the retry resends only what's outstanding.
 * `send` is injected (the function from createGmailSender, Task S6).
 */
export function useSendRunner(
  initial: MessageDraft[],
  send: SendFn,
  emailFor: EmailLookup = () => '',
): SendRunner {
  const [messages, setMessages] = useState<MessageDraft[]>(initial);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const mark = (studentId: string, status: MessageDraft['status']) =>
    setMessages((prev) => {
      const next = prev.map((m) => (m.studentId === studentId ? { ...m, status } : m));
      messagesRef.current = next;
      return next;
    });

  const runOutstanding = useCallback(async () => {
    setSending(true);
    setNeedsReauth(false);
    // Resend only messages not already sent.
    for (const m of messagesRef.current.filter((x) => x.status !== 'sent')) {
      try {
        await send({ id: m.studentId, email: emailFor(m.studentId), finalText: m.finalText });
        mark(m.studentId, 'sent');
      } catch (err) {
        if (isAuthError(err)) {
          // Batch-wide: stop, do NOT mark this message failed, request re-auth.
          setNeedsReauth(true);
          setSending(false);
          return;
        }
        mark(m.studentId, 'failed');
      }
    }
    setSending(false);
    setDone(true);
  }, []);

  const start = useCallback(() => runOutstanding(), [runOutstanding]);

  const reauthorizeAndRetry = useCallback(async () => {
    await signInWithGoogle(); // refreshes the Gmail-send scope / token
    await runOutstanding();
  }, [runOutstanding]);

  const failures = messages.filter((m) => m.status === 'failed');
  return { messages, failures, needsReauth, done, sending, start, reauthorizeAndRetry };
}
