import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComposeScreen } from './ComposeScreen';
import type { BankEntry, Student, ClassMeta, MessageDraft, FeedbackHistoryEntry } from '../types';

const historyEntry: FeedbackHistoryEntry = {
  id: 'h1',
  studentId: 's1',
  periodId: 'c1',
  courseId: 'co1',
  yearId: 'y1',
  sentAt: Date.UTC(2025, 9, 12),
  gradingPeriod: 'Q1',
  finalText: 'Carlos showed real growth leading the lab cleanup last quarter.',
  tags: { areas: [], sentiments: [], standards: [] },
  usedEntries: [],
};

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

  it('renders standard-filter chips and narrows the bank to entries carrying that standard', () => {
    const standardEntries: BankEntry[] = [
      { id: 's-cer', templateText: 'CER comment.', slots: [], tags: { type: 'success', area: 'cer', standard: 'SSS1.6-8.2' } },
      { id: 's-thesis', templateText: 'Thesis comment.', slots: [], tags: { type: 'success', area: 'thesis', standard: 'SSS4.6-8.1' } },
      { id: 's-generic', templateText: 'Generic comment.', slots: [], tags: { type: 'success', area: 'attitude' } },
    ];
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={standardEntries}
        onAutoSave={vi.fn()}
      />,
    );
    // The bare code is rendered on the chip; the full label is its accessible name.
    const chip = screen.getByRole('button', { name: /SSS4\.6-8\.1/ });
    expect(chip.textContent).toBe('SSS4.6-8.1');
    // All three entries visible before filtering.
    expect(screen.getByTestId('add-s-cer')).toBeTruthy();
    expect(screen.getByTestId('add-s-thesis')).toBeTruthy();
    expect(screen.getByTestId('add-s-generic')).toBeTruthy();
    // Filter to the thesis standard → only that entry remains.
    fireEvent.click(chip);
    expect(screen.getByTestId('add-s-thesis')).toBeTruthy();
    expect(screen.queryByTestId('add-s-cer')).toBeNull();
    expect(screen.queryByTestId('add-s-generic')).toBeNull();
    // Type + standard compose: also narrowing by a non-matching type empties it.
    fireEvent.click(chip); // clear standard
    expect(screen.getByTestId('add-s-cer')).toBeTruthy();
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

  it('flushes a pending edit synchronously on unmount (no lost last keystroke)', () => {
    const onAutoSave: ReturnType<typeof vi.fn> = vi.fn();
    const { unmount } = render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    fireEvent.click(screen.getByTestId('add-e1'));
    fireEvent.change(screen.getByLabelText('moment'), {
      target: { value: 'he redesigned the experiment' },
    });
    // Unmount BEFORE the 800ms debounce elapses — the edit is still pending.
    expect(onAutoSave).not.toHaveBeenCalled();
    act(() => {
      unmount();
    });
    expect(onAutoSave).toHaveBeenCalledTimes(1);
    const [batchId, draft] = onAutoSave.mock.calls[0] as [string, MessageDraft];
    expect(batchId).toBe('b1');
    expect(draft).toMatchObject<Partial<MessageDraft>>({
      studentId: 's1',
      usedEntries: ['e1'],
      slotValues: { moment: 'he redesigned the experiment' },
      finalText: 'Carlos grew this spring when he redesigned the experiment.',
    });
  });

  it('does NOT flush on unmount when nothing was touched', () => {
    const onAutoSave = vi.fn();
    const { unmount } = render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    act(() => {
      unmount();
    });
    expect(onAutoSave).not.toHaveBeenCalled();
  });

  it('does NOT double-save when the debounce already fired before unmount', () => {
    const onAutoSave = vi.fn();
    const { unmount } = render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    fireEvent.click(screen.getByTestId('add-e1'));
    vi.advanceTimersByTime(800);
    expect(onAutoSave).toHaveBeenCalledTimes(1);
    act(() => {
      unmount();
    });
    // Unmount must not re-fire a save that already flushed.
    expect(onAutoSave).toHaveBeenCalledTimes(1);
  });

  it('does NOT float zero-slot generic comments above personalized templates', () => {
    // Bank order is [e1 (3 slots), e2 (0 slots)]; the rendered order must match
    // (no slot-count reordering that would push the generic e2 to the top).
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button', { name: /grew this|Nice collaboration/ });
    expect(buttons[0]).toHaveTextContent('grew this');
    expect(buttons[1]).toHaveTextContent('Nice collaboration');
  });

  it('shows the specificity nudge for an entirely-generic message and hides it once a personal slot is filled', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    // No comments yet → no nudge.
    expect(screen.queryByTestId('specificity-nudge')).toBeNull();
    // Add the generic, slot-free comment → nudge appears.
    fireEvent.click(screen.getByTestId('add-e2'));
    expect(screen.getByTestId('specificity-nudge')).toBeTruthy();
    // Add a templated comment and fill its personal slot → nudge disappears.
    fireEvent.click(screen.getByTestId('add-e1'));
    expect(screen.getByTestId('specificity-nudge')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('moment'), {
      target: { value: 'he led the lab cleanup' },
    });
    expect(screen.queryByTestId('specificity-nudge')).toBeNull();
  });

  it('lets the teacher type freely; the typed text is what gets saved', () => {
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
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'A wholly hand-written message.' } });
    expect(field.value).toBe('A wholly hand-written message.');
    vi.advanceTimersByTime(800);
    expect(onAutoSave).toHaveBeenCalled();
    const calls = onAutoSave.mock.calls;
    const [, draft] = calls[calls.length - 1] as [string, MessageDraft];
    expect(draft.finalText).toBe('A wholly hand-written message.');
  });

  it('clicking a bank entry while clean mirrors the assembled template', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    expect(field.value).toBe('');
    fireEvent.click(screen.getByTestId('add-e2'));
    expect(field.value).toBe('Nice collaboration.');
    // still reactive to slot fills via assembled
    fireEvent.click(screen.getByTestId('add-e1'));
    expect(field.value).toContain('Nice collaboration.');
    expect(field.value).toContain('Carlos grew this spring when');
  });

  it('clicking a bank entry while dirty APPENDS to the typed text', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'My own intro.' } });
    fireEvent.click(screen.getByTestId('add-e2'));
    expect(field.value).toBe('My own intro.\n\nNice collaboration.');
  });

  it('preserves a resumed manually-edited draft (finalText differs from assembled)', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
        initialDraft={{
          usedEntries: ['e2'],
          slotValues: {},
          finalText: 'Hand-edited resumed text, not the template.',
        }}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    expect(field.value).toBe('Hand-edited resumed text, not the template.');
  });

  it('keeps a purely template-built resumed draft reactive (not dirty)', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
        initialDraft={{
          usedEntries: ['e2'],
          slotValues: {},
          finalText: 'Nice collaboration.',
        }}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    expect(field.value).toBe('Nice collaboration.');
    // Because it's clean, adding another entry mirrors the assembled template.
    fireEvent.click(screen.getByTestId('add-e1'));
    expect(field.value).toContain('Nice collaboration.');
    expect(field.value).toContain('Carlos grew this spring when');
  });

  it('clicking "Reference this" inserts a build-on-last-time callback into the message', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
        history={[historyEntry]}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    expect(field.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Reference this' }));
    // Inserts the finishable callback referencing the prior feedback excerpt.
    expect(field.value).toContain('Last time, I mentioned:');
    expect(field.value).toContain('Carlos showed real growth');
    expect(field.value).toMatch(/This time,\s*$/);
  });

  it('"Reference this" appends below existing typed text (preserves prior content)', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
        history={[historyEntry]}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'My own intro.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reference this' }));
    expect(field.value).toContain('My own intro.');
    expect(field.value).toContain('Last time, I mentioned:');
    expect(field.value.indexOf('My own intro.')).toBeLessThan(
      field.value.indexOf('Last time, I mentioned:'),
    );
  });

  it('Standards feedback: selecting a standard + "3 Proficient" inserts that comment with {name} filled', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    const select = screen.getByTestId('standards-feedback-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'C2.6-8.3' } });
    fireEvent.click(screen.getByRole('button', { name: '3 Proficient' }));
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    // C2.6-8.3 level 3 text, with {name} replaced by the student's first name.
    expect(field.value).toContain(
      'Carlos, you accurately describe the structure of the national government',
    );
    expect(field.value).not.toContain('{name}');
  });

  it('Standards feedback: "Include next step" includes the nextStep when checked and omits it when unchecked', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    const select = screen.getByTestId('standards-feedback-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'C2.6-8.3' } });
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    const nextStep = 'Add depth by explaining why a power was given to one branch and not another.';

    // Default: checkbox checked → nextStep included.
    fireEvent.click(screen.getByRole('button', { name: '3 Proficient' }));
    expect(field.value).toContain(nextStep);

    // Uncheck → nextStep omitted on the next insert.
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Include next step'));
    fireEvent.click(screen.getByRole('button', { name: '3 Proficient' }));
    expect(field.value).not.toContain(nextStep);
    expect(field.value).toContain(
      'Carlos, you accurately describe the structure of the national government',
    );
  });

  it('Standards feedback: inserting appends below existing typed text rather than replacing it', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    const field = screen.getByTestId('final-text') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'My own intro.' } });
    const select = screen.getByTestId('standards-feedback-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'C2.6-8.3' } });
    fireEvent.click(screen.getByRole('button', { name: '4 Exemplary' }));
    expect(field.value).toContain('My own intro.');
    expect(field.value.indexOf('My own intro.')).toBeLessThan(
      field.value.indexOf('Carlos,'),
    );
  });

  it('renders the empty history state when the student has no prior feedback', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
        history={[]}
      />,
    );
    expect(screen.getByText(/No feedback sent to Carlos yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reference this' })).toBeNull();
  });
});
