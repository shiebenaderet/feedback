import { describe, it, expect } from 'vitest';
import { summarizeHistoryEntry } from './summarizeHistoryEntry';
import type { FeedbackHistoryEntry } from '../types';

const base: FeedbackHistoryEntry = {
  id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
  // 2025-10-12T15:00:00Z — fixed epoch ms so the format is deterministic.
  sentAt: Date.UTC(2025, 9, 12, 15, 0, 0),
  gradingPeriod: 'Q1',
  finalText: 'Strong quarter, Ada. Your CER was the sharpest in class and your evidence held up.',
  tags: { areas: ['cer'], sentiments: ['strength'], standards: ['argumentation'] },
  usedEntries: ['seed-cer-success-1'],
};

describe('summarizeHistoryEntry', () => {
  it('formats "MMM D · <gradingPeriod> — <label or trimmed finalText>"', () => {
    expect(summarizeHistoryEntry(base)).toBe(
      'Oct 12 · Q1 — Strong quarter, Ada. Your CER was the sharpest in class and…',
    );
  });

  it('prefers an explicit label over finalText when present', () => {
    expect(summarizeHistoryEntry({ ...base, label: 'Quarter check-in' })).toBe(
      'Oct 12 · Q1 — Quarter check-in',
    );
  });

  it('does not append an ellipsis when the text already fits', () => {
    expect(summarizeHistoryEntry({ ...base, finalText: 'Nice work.' })).toBe(
      'Oct 12 · Q1 — Nice work.',
    );
  });
});
