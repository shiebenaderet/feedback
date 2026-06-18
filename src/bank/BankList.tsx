// src/bank/BankList.tsx
import { useMemo, useState } from "react";
import { filterBankEntries } from "./filterBankEntries";
import type { BankEntry, BankTags } from "./types";
import { tokens, panelStyle } from "../ui/theme";

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
    <div style={{ display: "grid", gap: tokens.space(2) }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: tokens.space(2),
        }}
      >
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
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            ...panelStyle(),
            textAlign: "center",
            padding: tokens.space(4),
          }}
        >
          <p style={{ margin: 0, color: tokens.color.muted }}>
            No entries match the current filters.
          </p>
          <p style={{ margin: `${tokens.space(1)}px 0 0`, color: tokens.color.subtle, fontSize: 13 }}>
            Try clearing the search box or choosing “All” types.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, display: "grid", gap: tokens.space(1) }}>
          {visible.map((entry) => (
            <li
              key={entry.id}
              style={{
                ...panelStyle(),
                background: tokens.color.panelAlt,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {entry.templateText}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
