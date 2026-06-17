import type { MessageDraft } from '../types';
import type { GmailSender } from './batchSendMachine';
import type { RunSend } from '../review/ReviewScreenContainer';

export type EmailFor = (studentId: string) => string;

/**
 * Adapts a GmailSender (from createGmailSender) into the container's RunSend.
 * MessageDraft carries no email, so we resolve it from the roster via emailFor,
 * keyed by studentId. Sends sequentially; a per-message failure is recorded as
 * status:'failed' and never halts the batch. onProgress fires after each result.
 * No new send logic — just shape-mapping around the existing sender.
 */
export function makeRunSend(sender: GmailSender, emailFor: EmailFor): RunSend {
  return async (messages, onProgress) => {
    const results: MessageDraft[] = [];
    for (const m of messages) {
      let next: MessageDraft;
      try {
        await sender({ id: m.studentId, email: emailFor(m.studentId), finalText: m.finalText });
        next = { ...m, status: 'sent' };
      } catch {
        next = { ...m, status: 'failed' };
      }
      results.push(next);
      onProgress(next);
    }
    return results;
  };
}
