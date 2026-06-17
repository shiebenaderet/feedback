import { describe, it, expect, vi } from 'vitest';
import { writeFeedbackHistory } from './writeFeedbackHistory';
import type { BankEntry, MessageDraft } from '../types';

function makeBank(): BankEntry[] {
  return [
    { id: 'e1', templateText: 'Great work {name}', slots: [], tags: { area: 'cer', type: 'success' } },
    { id: 'e2', templateText: 'Speak up more', slots: [], tags: { area: 'discussion', type: 'growth' } },
    { id: 'e3', templateText: 'unused', slots: [], tags: { area: 'research', type: 'skill' } },
  ];
}

function makeDraft(): MessageDraft {
  return {
    studentId: 's1',
    name: 'Ana',
    usedEntries: ['e1', 'e2'],
    slotValues: {},
    finalText: 'Great work Ana. Speak up more.',
    status: 'sent',
  };
}

describe('writeFeedbackHistory', () => {
  it('writes a FeedbackHistoryEntry under the student with derived tags', async () => {
    const db = { __fake: true } as any;
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'h1' }));

    const id = await writeFeedbackHistory(
      db,
      'u1',
      {
        draft: makeDraft(),
        bankEntries: makeBank(),
        tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
        gradingPeriod: 'Q1',
        label: 'Unit 3',
        sentAt: 1718000000000,
      },
      { collection, addDoc } as any,
    );

    expect(id).toBe('h1');
    expect(collection).toHaveBeenCalledWith(
      db,
      'teachers/u1/years/y1/courses/co1/periods/p4/students/s1/feedbackHistory',
    );

    const written = addDoc.mock.calls[0][1] as any;
    expect(written).toMatchObject({
      studentId: 's1',
      periodId: 'p4',
      courseId: 'co1',
      yearId: 'y1',
      sentAt: 1718000000000,
      gradingPeriod: 'Q1',
      label: 'Unit 3',
      finalText: 'Great work Ana. Speak up more.',
      usedEntries: ['e1', 'e2'],
    });
    // tags derived only from the USED entries (e1, e2) — not the unused e3.
    expect(written.tags).toEqual({
      areas: ['cer', 'discussion'],
      sentiments: ['strength', 'growth'],
      standards: [],
    });
  });

  it('omits an empty label rather than writing label:""', async () => {
    const db = { __fake: true } as any;
    const collection = vi.fn(() => ({}));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'h2' }));

    await writeFeedbackHistory(
      db,
      'u1',
      {
        draft: makeDraft(),
        bankEntries: makeBank(),
        tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
        gradingPeriod: 'Q2',
        label: '',
        sentAt: 1,
      },
      { collection, addDoc } as any,
    );

    const written = addDoc.mock.calls[0][1] as any;
    expect('label' in written).toBe(false);
  });

  it('resolves used entries by id, ignoring used ids missing from the bank', async () => {
    const db = { __fake: true } as any;
    const collection = vi.fn(() => ({}));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'h3' }));

    const draft: MessageDraft = { ...makeDraft(), usedEntries: ['e1', 'ghost'] };
    await writeFeedbackHistory(
      db,
      'u1',
      {
        draft,
        bankEntries: makeBank(),
        tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
        gradingPeriod: 'Q1',
        label: '',
        sentAt: 1,
      },
      { collection, addDoc } as any,
    );

    const written = addDoc.mock.calls[0][1] as any;
    // 'ghost' is still recorded for traceability...
    expect(written.usedEntries).toEqual(['e1', 'ghost']);
    // ...but only the resolvable entry (e1) contributes derived tags.
    expect(written.tags.areas).toEqual(['cer']);
    expect(written.tags.sentiments).toEqual(['strength']);
  });
});
