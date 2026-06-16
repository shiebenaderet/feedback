import { describe, it, expect } from 'vitest';
import { deriveTypeOptions, filterEntriesByType } from './bankFilter';
import type { BankEntry } from '../types';

const entries: BankEntry[] = [
  { id: 'e1', templateText: '{name} a', slots: [{ key: 'name', kind: 'auto' }], tags: { type: 'growth' } },
  { id: 'e2', templateText: 'b', slots: [], tags: { type: 'behavior' } },
  { id: 'e3', templateText: 'c', slots: [], tags: { type: 'growth' } },
  { id: 'e4', templateText: 'd', slots: [], tags: {} }, // no type
];

describe('deriveTypeOptions', () => {
  it('returns the distinct, sorted, defined types present in the entries', () => {
    // NOT the hardcoded ['success','growth']: 'success' is absent, 'behavior' is present.
    expect(deriveTypeOptions(entries)).toEqual(['behavior', 'growth']);
  });

  it('returns an empty list when no entries have a type', () => {
    expect(deriveTypeOptions([entries[3]])).toEqual([]);
  });
});

describe('filterEntriesByType', () => {
  it('returns all entries when type is null (no filter)', () => {
    expect(filterEntriesByType(entries, null).map((e) => e.id)).toEqual([
      'e1', 'e2', 'e3', 'e4',
    ]);
  });

  it('returns only entries matching the selected type', () => {
    expect(filterEntriesByType(entries, 'growth').map((e) => e.id)).toEqual(['e1', 'e3']);
  });
});
