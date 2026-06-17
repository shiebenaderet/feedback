import { describe, it, expect, vi } from 'vitest';
import { makeRunSend } from './makeRunSend';
import type { MessageDraft } from '../types';

const drafts: MessageDraft[] = [
  { studentId: 's1', name: 'Ana', usedEntries: [], slotValues: {}, finalText: 'Hi Ana', status: 'draft' },
  { studentId: 's2', name: 'Ben', usedEntries: [], slotValues: {}, finalText: 'Hi Ben', status: 'draft' },
];
const emailFor = (id: string) => (id === 's1' ? 'a@x.edu' : 'b@x.edu');

describe('makeRunSend', () => {
  it('sends each message via the gmail sender and reports progress', async () => {
    const sender = vi.fn(async () => undefined); // GmailSender resolves on success
    const progress: string[] = [];
    const runSend = makeRunSend(sender, emailFor);

    const out = await runSend(drafts, (m) => progress.push(`${m.studentId}:${m.status}`));

    expect(sender).toHaveBeenCalledTimes(2);
    expect(sender).toHaveBeenCalledWith({ id: 's1', email: 'a@x.edu', finalText: 'Hi Ana' });
    expect(out.every((m) => m.status === 'sent')).toBe(true);
    expect(progress).toEqual(['s1:sent', 's2:sent']);
  });

  it('marks a failed message without halting the batch', async () => {
    const sender = vi.fn(async (m: { id: string }) => {
      if (m.id === 's1') throw new Error('boom');
    });
    const runSend = makeRunSend(sender, emailFor);

    const out = await runSend(drafts, () => {});

    expect(out.find((m) => m.studentId === 's1')!.status).toBe('failed');
    expect(out.find((m) => m.studentId === 's2')!.status).toBe('sent');
  });
});
