// src/compose/filterBankByTags.ts

export interface BankTags {
  type?: string;
  area?: string;
  objective?: string;
  tone?: string;
}

export interface BankEntry {
  id: string;
  templateText: string;
  slots: { key: string; kind: 'auto' | 'fill'; hint?: string }[];
  tags: BankTags;
}

export type TagFilter = BankTags;

const TAG_KEYS: (keyof BankTags)[] = ['type', 'area', 'objective', 'tone'];

/**
 * Filter the bank for the right-panel picker. Each provided, non-empty filter key must
 * match the entry's tag exactly; omitted or empty-string keys mean "any". Multiple keys AND.
 */
export function filterBankByTags(entries: BankEntry[], filter: TagFilter): BankEntry[] {
  return entries.filter((entry) =>
    TAG_KEYS.every((key) => {
      const want = filter[key];
      if (want == null || want === '') return true;
      return entry.tags[key] === want;
    }),
  );
}
