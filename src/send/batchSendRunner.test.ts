// src/send/batchSendRunner.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  createSendState,
  runSend,
  progressOf,
  failedIds,
  type SendState,
} from './batchSendMachine';

const msgs = [
  { id: 'm1', email: 'a@x.com', finalText: 'Hi A' },
  { id: 'm2', email: 'b@x.com', finalText: 'Hi B' },
  { id: 'm3', email: 'c@x.com', finalText: 'Hi C' },
];

describe('runSend', () => {
  it('sends every message when the sender resolves', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const final = await runSend(createSendState(msgs), msgs, send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(final.statuses).toEqual({ m1: 'sent', m2: 'sent', m3: 'sent' });
    expect(final.phase).toBe('done');
  });

  it('does not halt on a partial failure; others still send', async () => {
    const send = vi.fn(async (m: { id: string }) => {
      if (m.id === 'm2') throw new Error('quota');
    });
    const final = await runSend(createSendState(msgs), msgs, send);
    expect(final.statuses).toEqual({ m1: 'sent', m2: 'failed', m3: 'sent' });
    expect(final.errors.m2).toBe('quota');
    expect(failedIds(final)).toEqual(['m2']);
  });

  it('retry touches only the failed messages', async () => {
    const send = vi.fn(async (m: { id: string }) => {
      if (m.id === 'm2') throw new Error('quota');
    });
    const afterFirst = await runSend(createSendState(msgs), msgs, send);

    // Retry: only the failed message is retried, and now it succeeds.
    send.mockClear();
    const retrySender = vi.fn().mockResolvedValue(undefined);
    const failedMsgs = msgs.filter((m) => failedIds(afterFirst).includes(m.id));
    const afterRetry = await runSend(afterFirst, failedMsgs, retrySender);

    expect(retrySender).toHaveBeenCalledTimes(1);
    expect(retrySender).toHaveBeenCalledWith(failedMsgs[0]);
    expect(afterRetry.statuses).toEqual({ m1: 'sent', m2: 'sent', m3: 'sent' });
    expect(failedIds(afterRetry)).toEqual([]);
  });

  it('progressOf reports sent vs total', () => {
    let state: SendState = createSendState(msgs);
    state = { ...state, statuses: { m1: 'sent', m2: 'failed', m3: 'pending' } };
    expect(progressOf(state)).toEqual({ done: 2, total: 3, sent: 1, failed: 1 });
  });
});
