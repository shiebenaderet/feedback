// src/bank/BankList.tsx
import { useMemo, useState } from "react";
import { filterBankEntries } from "./filterBankEntries";
import type { BankEntry, BankTags } from "./types";

// BankEntry = { id; templateText; slots; tags: BankTags }
// filterBankEntries(entries, { tags: Partial<BankTags>; search: string })

interface BankListProps {
  entries: BankEntry[];
}

export function BankList({ entries }: BankListProps) {
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const tags = useMemo<Partial<BankTags>>(
    () => (typeFilter ? { type: typeFilter } : {}),
    [typeFilter]
  );

  const visible = useMemo(
    () => filterBankEntries(entries, { tags, search }),
    [entries, tags, search]
  );

  // Distinct type values present in the bank, for the filter dropdown.
  const typeOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.tags.type).filter(Boolean))),
    [entries]
  );

  return (
    <div>
      <label htmlFor="bank-search">Search</label>
      <input
        id="bank-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <label htmlFor="bank-type-filter">Filter by type</label>
      <select
        id="bank-type-filter"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="">All</option>
        {typeOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {visible.length === 0 ? (
        <p>No entries match the current filters.</p>
      ) : (
        <ul>
          {visible.map((entry) => (
            <li key={entry.id}>{entry.templateText}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
