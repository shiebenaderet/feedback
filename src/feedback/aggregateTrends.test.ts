import { describe, it, expect } from 'vitest';
import { aggregateTrends } from './aggregateTrends';
import type { BankEntry, FeedbackHistoryEntry } from '../types';

// Minimal bank: only the `tags.type` matters for sentiment re-derivation.
const bank: BankEntry[] = [
  { id: 'b-success', templateText: '', slots: [], tags: { type: 'success', area: 'cer', objective: 'argumentation' } },
  { id: 'b-growth', templateText: '', slots: [], tags: { type: 'growth', area: 'discussion', objective: 'participation' } },
  { id: 'b-behavior', templateText: '', slots: [], tags: { type: 'behavior', area: 'collaboration', objective: 'reliability' } },
];

function h(over: Partial<FeedbackHistoryEntry>): FeedbackHistoryEntry {
  return {
    id: 'h', studentId: 's', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: 0, gradingPeriod: 'Q1', finalText: '',
    tags: { areas: [], sentiments: [], standards: [] },
    usedEntries: [],
    ...over,
  };
}

describe('aggregateTrends', () => {
  it('counts by area from entry tags.areas', () => {
    const entries = [
      h({ tags: { areas: ['cer', 'discussion'], sentiments: ['strength'], standards: [] } }),
      h({ tags: { areas: ['cer'], sentiments: ['growth'], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    expect(t.byArea).toEqual({ cer: 2, discussion: 1 });
  });

  it('re-derives sentiment from usedEntries via the taxonomy, not from stored tags', () => {
    // Stored sentiments deliberately WRONG to prove re-derivation wins.
    const entries = [
      h({ usedEntries: ['b-success'], tags: { areas: ['cer'], sentiments: ['growth'], standards: [] } }),
      h({ usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: ['strength'], standards: [] } }),
      h({ usedEntries: ['b-behavior'], tags: { areas: ['collaboration'], sentiments: ['strength'], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    // success→strength, growth→growth, behavior→neutral
    expect(t.bySentiment).toEqual({ strength: 1, growth: 1, neutral: 1 });
    expect(t.strengthGrowthBalance).toEqual({ strength: 1, growth: 1 });
  });

  it('falls back to stored tags.sentiments when a usedEntry is not in the bank', () => {
    const entries = [h({ usedEntries: ['unknown-id'], tags: { areas: [], sentiments: ['strength'], standards: [] } })];
    const t = aggregateTrends(entries, bank);
    expect(t.bySentiment).toEqual({ strength: 1 });
  });

  it('counts by gradingPeriod and by standard', () => {
    const entries = [
      h({ gradingPeriod: 'Q1', tags: { areas: [], sentiments: [], standards: ['argumentation', 'reasoning'] } }),
      h({ gradingPeriod: 'Q1', tags: { areas: [], sentiments: [], standards: ['argumentation'] } }),
      h({ gradingPeriod: 'Q2', tags: { areas: [], sentiments: [], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    expect(t.byGradingPeriod).toEqual({ Q1: 2, Q2: 1 });
    expect(t.byStandard).toEqual({ argumentation: 2, reasoning: 1 });
  });

  it('topGrowthAreas lists areas of growth-sentiment entries, most frequent first', () => {
    const entries = [
      h({ usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: [], standards: [] } }),
      h({ usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: [], standards: [] } }),
      h({ usedEntries: ['b-growth'], tags: { areas: ['research'], sentiments: [], standards: [] } }),
      h({ usedEntries: ['b-success'], tags: { areas: ['cer'], sentiments: [], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    expect(t.topGrowthAreas).toEqual([
      { area: 'discussion', count: 2 },
      { area: 'research', count: 1 },
    ]);
  });

  it('returns all-empty buckets for no entries', () => {
    const t = aggregateTrends([], bank);
    expect(t).toEqual({
      total: 0,
      byArea: {},
      bySentiment: {},
      byGradingPeriod: {},
      byStandard: {},
      strengthGrowthBalance: { strength: 0, growth: 0 },
      topGrowthAreas: [],
    });
  });
});
