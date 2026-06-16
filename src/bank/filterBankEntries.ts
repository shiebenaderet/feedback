// src/bank/filterBankEntries.ts
import type { BankEntry, BankTags } from "./types";

// BankEntry = { id; templateText; slots; tags: BankTags }
// BankTags  = { type; area; objective; tone } (all string)

export interface BankFilter {
  // Subset of tag keys to filter on; blank/undefined values are ignored.
  tags: Partial<BankTags>;
  // Free-text search over templateText; trimmed, case-insensitive.
  search: string;
}

/**
 * Pure filter over bank entries: keeps an entry only if every non-blank tag
 * filter matches exactly AND (when a search term is given) its templateText
 * contains the term, case-insensitively. Source order is preserved.
 */
export function filterBankEntries(
  entries: BankEntry[],
  filter: BankFilter
): BankEntry[] {
  const term = filter.search.trim().toLowerCase();
  const tagPairs = (Object.entries(filter.tags) as [keyof BankTags, string | undefined][])
    .filter(([, value]) => value !== undefined && value !== "");

  return entries.filter((entry) => {
    const tagsMatch = tagPairs.every(([key, value]) => entry.tags[key] === value);
    const searchMatches =
      term === "" || entry.templateText.toLowerCase().includes(term);
    return tagsMatch && searchMatches;
  });
}
