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

/** Captures the (path, id, data) of each setDoc so tests can assert idempotency. */
function makeDeps() {
  const doc = vi.fn((_db: unknown, path: string, id: string) => ({ __ref: `${path}/${id}` }));
  const setDoc = vi.fn(async (_ref: unknown, _data: unknown) => undefined);
  return { doc, setDoc };
}

describe('writeFeedbackHistory', () => {
  it('writes a FeedbackHistoryEntry at a deterministic {batchId}__{studentId} id with derived tags', async () => {
    const db = { __fake: true } as any;
    const deps = makeDeps();

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
        batchId: 'b9',
      },
      deps as any,
    );

    expect(id).toBe('b9__s1');
    expect(deps.doc).toHaveBeenCalledWith(
      db,
      'teachers/u1/years/y1/courses/co1/periods/p4/students/s1/feedbackHistory',
      'b9__s1',
    );

    const written = deps.setDoc.mock.calls[0][1] as any;
    expect(written).toMatchObject({
      ownerUid: 'u1',
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
    expect(written.tags).toEqual({
      areas: ['cer', 'discussion'],
      sentiments: ['strength', 'growth'],
      standards: [],
    });
  });

  it('is idempotent: re-writing the same (batch, student) overwrites the SAME doc id', async () => {
    const db = { __fake: true } as any;
    const deps = makeDeps();
    const args = {
      draft: makeDraft(),
      bankEntries: makeBank(),
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1' as const,
      label: '',
      sentAt: 1,
      batchId: 'b9',
    };

    await writeFeedbackHistory(db, 'u1', args, deps as any);
    await writeFeedbackHistory(db, 'u1', args, deps as any);

    // Both writes targeted the identical doc id — no duplicate history entry.
    expect(deps.doc.mock.calls[0][2]).toBe('b9__s1');
    expect(deps.doc.mock.calls[1][2]).toBe('b9__s1');
  });

  it('omits an empty label rather than writing label:""', async () => {
    const db = { __fake: true } as any;
    const deps = makeDeps();

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
        batchId: 'b1',
      },
      deps as any,
    );

    const written = deps.setDoc.mock.calls[0][1] as any;
    expect('label' in written).toBe(false);
  });

  it('resolves used entries by id, ignoring used ids missing from the bank', async () => {
    const db = { __fake: true } as any;
    const deps = makeDeps();

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
        batchId: 'b1',
      },
      deps as any,
    );

    const written = deps.setDoc.mock.calls[0][1] as any;
    expect(written.usedEntries).toEqual(['e1', 'ghost']);
    expect(written.tags.areas).toEqual(['cer']);
    expect(written.tags.sentiments).toEqual(['strength']);
  });
});
