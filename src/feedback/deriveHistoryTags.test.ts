import { describe, it, expect } from 'vitest';
import { deriveHistoryTags } from './deriveHistoryTags';
import type { BankEntry } from '../types';

const entry = (id: string, tags: BankEntry['tags']): BankEntry => ({
  id,
  templateText: 't',
  slots: [],
  tags,
});

describe('deriveHistoryTags', () => {
  it('collects areas from each entry tags.area, deduped and order-stable', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success' }),
      entry('e2', { area: 'discussion', type: 'growth' }),
      entry('e3', { area: 'cer', type: 'success' }),
    ]);
    expect(tags.areas).toEqual(['cer', 'discussion']);
  });

  it('maps tags.type to sentiments via the taxonomy: success→strength, growth→growth', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success' }),
      entry('e2', { area: 'discussion', type: 'growth' }),
    ]);
    expect(tags.sentiments).toEqual(['strength', 'growth']);
  });

  it('maps behavior and skill types to neutral (not a strength/growth axis)', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'professionalism', type: 'behavior' }),
      entry('e2', { area: 'research', type: 'skill' }),
    ]);
    expect(tags.sentiments).toEqual(['neutral']);
  });

  it('dedupes sentiments across multiple entries of the same axis', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success' }),
      entry('e2', { area: 'discussion', type: 'success' }),
    ]);
    expect(tags.sentiments).toEqual(['strength']);
  });

  it('omits a missing area without inserting an empty string', () => {
    const tags = deriveHistoryTags([
      entry('e1', { type: 'success' }),
      entry('e2', { area: 'cer', type: 'growth' }),
    ]);
    expect(tags.areas).toEqual(['cer']);
  });

  it('skips entries whose type does not map to any sentiment', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer' }), // no type
      entry('e2', { area: 'discussion', type: 'success' }),
    ]);
    expect(tags.sentiments).toEqual(['strength']);
  });

  it('reads standards from a future standard tag, empty when none present', () => {
    const tags = deriveHistoryTags([entry('e1', { area: 'cer', type: 'success' })]);
    expect(tags.standards).toEqual([]);
  });

  it('collects standards from a (string[] or string) standard tag when present', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success', standard: 'RH.6-8.1' } as any),
      entry('e2', { area: 'cer', type: 'growth', standard: ['RH.6-8.2', 'RH.6-8.1'] } as any),
    ]);
    expect(tags.standards).toEqual(['RH.6-8.1', 'RH.6-8.2']);
  });

  it('returns empty arrays for no entries', () => {
    expect(deriveHistoryTags([])).toEqual({ areas: [], sentiments: [], standards: [] });
  });
});
