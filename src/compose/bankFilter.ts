import type { BankEntry } from '../types';

/** Distinct, sorted, defined `tags.type` values present in the given entries. */
export function deriveTypeOptions(entries: BankEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    const t = e.tags.type;
    if (t) set.add(t);
  }
  return [...set].sort();
}

/** Filter entries by type; `null` means no filter (return all). */
export function filterEntriesByType(
  entries: BankEntry[],
  type: string | null,
): BankEntry[] {
  if (type === null) return entries;
  return entries.filter((e) => e.tags.type === type);
}
