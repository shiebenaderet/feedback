// src/send/batchSendMachine.ts

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type SendPhase = 'idle' | 'running' | 'done';

// Minimal message snapshot the machine operates on.
export interface SendableMessage {
  id: string;
  email: string;
  finalText: string;
}

export interface SendState {
  order: string[]; // message ids in send order
  statuses: Record<string, MessageStatus>;
  errors: Record<string, string>;
  phase: SendPhase;
}

export function createSendState(messages: SendableMessage[]): SendState {
  const statuses: Record<string, MessageStatus> = {};
  for (const m of messages) statuses[m.id] = 'pending';
  return {
    order: messages.map((m) => m.id),
    statuses,
    errors: {},
    phase: 'idle',
  };
}

export function markSending(state: SendState, id: string): SendState {
  return { ...state, statuses: { ...state.statuses, [id]: 'sending' } };
}

export function markSent(state: SendState, id: string): SendState {
  const errors = { ...state.errors };
  delete errors[id];
  return { ...state, statuses: { ...state.statuses, [id]: 'sent' }, errors };
}

export function markFailed(state: SendState, id: string, reason: string): SendState {
  return {
    ...state,
    statuses: { ...state.statuses, [id]: 'failed' },
    errors: { ...state.errors, [id]: reason },
  };
}

// Append to src/send/batchSendMachine.ts

export type GmailSender = (message: SendableMessage) => Promise<void>;

// Runs the given subset of messages through the sender, mutating only those ids.
// Messages NOT in `toSend` keep whatever status they already had (retry isolation).
export async function runSend(
  state: SendState,
  toSend: SendableMessage[],
  sender: GmailSender,
): Promise<SendState> {
  let current: SendState = { ...state, phase: 'running' };
  for (const msg of toSend) {
    current = markSending(current, msg.id);
    try {
      await sender(msg);
      current = markSent(current, msg.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      current = markFailed(current, msg.id, reason);
    }
  }
  return { ...current, phase: 'done' };
}

export interface SendProgress {
  done: number;  // sent + failed
  total: number;
  sent: number;
  failed: number;
}

export function progressOf(state: SendState): SendProgress {
  const values = Object.values(state.statuses);
  const sent = values.filter((s) => s === 'sent').length;
  const failed = values.filter((s) => s === 'failed').length;
  return { done: sent + failed, total: values.length, sent, failed };
}

export function failedIds(state: SendState): string[] {
  return state.order.filter((id) => state.statuses[id] === 'failed');
}
