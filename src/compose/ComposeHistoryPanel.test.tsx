import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComposeHistoryPanel } from './ComposeHistoryPanel';
import type { FeedbackHistoryEntry } from '../types';

function entry(over: Partial<FeedbackHistoryEntry>): FeedbackHistoryEntry {
  return {
    id: 'h', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: Date.UTC(2025, 9, 12, 15, 0, 0), gradingPeriod: 'Q1',
    finalText: 'Strong quarter, Ada.',
    tags: { areas: ['cer'], sentiments: ['strength'], standards: [] },
    usedEntries: ['seed-cer-success-1'],
    ...over,
  };
}

describe('ComposeHistoryPanel', () => {
  it('renders dated summaries for each recent entry, newest first', () => {
    const entries = [
      entry({ id: 'h2', sentAt: Date.UTC(2026, 0, 5, 15, 0, 0), gradingPeriod: 'Q2', label: 'Mid-year note' }),
      entry({ id: 'h1' }),
    ];
    render(<ComposeHistoryPanel studentName="Ada" entries={entries} />);

    expect(screen.getByText('Jan 5 · Q2 — Mid-year note')).toBeInTheDocument();
    expect(screen.getByText('Oct 12 · Q1 — Strong quarter, Ada.')).toBeInTheDocument();
    // Newest entry is rendered before the older one.
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Jan 5');
    expect(items[1]).toHaveTextContent('Oct 12');
  });

  it('shows an empty-state message when there is no prior feedback', () => {
    render(<ComposeHistoryPanel studentName="Ada" entries={[]} />);
    expect(screen.getByText(/no feedback sent to ada yet/i)).toBeInTheDocument();
  });

  it('caps the list at the most recent N (default 5)', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      entry({ id: `h${i}`, sentAt: Date.UTC(2025, 8, 1 + i, 12, 0, 0), finalText: `note ${i}` }),
    ).reverse(); // newest first, as the data fn returns them
    render(<ComposeHistoryPanel studentName="Ada" entries={many} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
