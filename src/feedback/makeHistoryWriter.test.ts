import { describe, it, expect, vi } from 'vitest';
import { makeHistoryWriter } from './makeHistoryWriter';
import type { BankEntry, MessageDraft } from '../types';

const bank: BankEntry[] = [
  { id: 'e1', templateText: 'x', slots: [], tags: { area: 'cer', type: 'success' } },
];

const draft: MessageDraft = {
  studentId: 's1',
  name: 'Ana',
  usedEntries: ['e1'],
  slotValues: {},
  finalText: 'Hi Ana',
  status: 'sent',
};

describe('makeHistoryWriter', () => {
  it('returns a sink that calls writeFeedbackHistory with the bound context', async () => {
    const writeFeedbackHistory = vi.fn(async () => 'h1');
    const onSent = makeHistoryWriter({
      db: { __fake: true } as any,
      uid: 'u1',
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: 'Unit 3',
      bankEntries: bank,
      batchId: 'b7',
      now: () => 1718000000000,
      writeFeedbackHistory,
    });

    await onSent(draft);

    expect(writeFeedbackHistory).toHaveBeenCalledTimes(1);
    expect(writeFeedbackHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', {
      draft,
      bankEntries: bank,
      batchId: 'b7',
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: 'Unit 3',
      sentAt: 1718000000000,
    });
  });

  it('does not throw to the caller if a history write fails (best-effort)', async () => {
    const writeFeedbackHistory = vi.fn(async () => {
      throw new Error('offline');
    });
    const onError = vi.fn();
    const onSent = makeHistoryWriter({
      db: {} as any,
      uid: 'u1',
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: '',
      bankEntries: bank,
      batchId: 'b7',
      now: () => 1,
      writeFeedbackHistory,
      onError,
    });

    await expect(onSent(draft)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
