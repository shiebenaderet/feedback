import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComposeScreen } from './ComposeScreen';
import type { BankEntry, Student, ClassMeta, MessageDraft } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const entries: BankEntry[] = [
  {
    id: 'e1',
    templateText: '{name} grew this {semester} when {moment}.',
    slots: [
      { key: 'name', kind: 'auto' },
      { key: 'semester', kind: 'auto' },
      { key: 'moment', kind: 'fill', hint: 'a specific moment' },
    ],
    tags: { type: 'growth' },
  },
  { id: 'e2', templateText: 'Nice collaboration.', slots: [], tags: { type: 'behavior' } },
];

describe('ComposeScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders type-filter chips derived from entries (behavior, growth — not success)', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'growth' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'behavior' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'success' })).toBeNull();
  });

  it('adding an entry + filling a slot debounce-saves a real MessageDraft with batchId', async () => {
    const onAutoSave: ReturnType<typeof vi.fn> = vi.fn();
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    // add entry e1 from the bank picker (the add button carries a stable testid)
    fireEvent.click(screen.getByTestId('add-e1'));
    // fill its slot
    fireEvent.change(screen.getByLabelText('moment'), {
      target: { value: 'he redesigned the experiment' },
    });
    // advance past the 800ms debounce
    vi.advanceTimersByTime(800);
    expect(onAutoSave).toHaveBeenCalled();
    const calls = onAutoSave.mock.calls;
    const [batchId, draft] = calls[calls.length - 1] as [string, MessageDraft];
    expect(batchId).toBe('b1');
    expect(draft).toMatchObject<Partial<MessageDraft>>({
      studentId: 's1',
      name: 'Carlos',
      usedEntries: ['e1'],
      slotValues: { moment: 'he redesigned the experiment' },
      finalText: 'Carlos grew this spring when he redesigned the experiment.',
      status: 'draft',
    });
  });

  it('does NOT save the empty stub before any edit (debounce + no-op guard)', () => {
    const onAutoSave = vi.fn();
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    vi.advanceTimersByTime(800);
    expect(onAutoSave).not.toHaveBeenCalled();
  });
});
