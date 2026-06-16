// src/compose/filterBankByTags.test.ts
import { describe, it, expect } from 'vitest';
import { filterBankByTags } from './filterBankByTags';

// Shapes restated from the data model (spec):
// BankEntry: { id; templateText; slots; tags: { type?; area?; objective?; tone? } }
// TagFilter: { type?; area?; objective?; tone? }  (omitted/empty key = "any")

const bank = [
  { id: 'b1', templateText: 'A', slots: [], tags: { type: 'success', area: 'lab', tone: 'warm' } },
  { id: 'b2', templateText: 'B', slots: [], tags: { type: 'growth', area: 'lab', tone: 'firm' } },
  { id: 'b3', templateText: 'C', slots: [], tags: { type: 'success', area: 'essay', tone: 'warm' } },
];

describe('filterBankByTags', () => {
  it('returns all entries when filter is empty', () => {
    expect(filterBankByTags(bank, {}).map((e) => e.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('filters by a single tag', () => {
    expect(filterBankByTags(bank, { type: 'success' }).map((e) => e.id)).toEqual(['b1', 'b3']);
  });

  it('ANDs multiple tag constraints', () => {
    expect(filterBankByTags(bank, { type: 'success', tone: 'warm' }).map((e) => e.id)).toEqual([
      'b1',
      'b3',
    ]);
    expect(filterBankByTags(bank, { area: 'lab', tone: 'firm' }).map((e) => e.id)).toEqual(['b2']);
  });

  it('treats empty-string filter values as "any"', () => {
    expect(filterBankByTags(bank, { type: '', area: 'essay' }).map((e) => e.id)).toEqual(['b3']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterBankByTags(bank, { type: 'success', area: 'lab', tone: 'firm' })).toEqual([]);
  });
});
