// src/roster/types.ts

/** A cleaned, importable student record produced from one CSV data row. */
export interface ParsedStudent {
  name: string;
  email: string;
  /** Optional class period; empty string when the column is absent/blank. */
  period: string;
  /** 1-based index of the source data row (header = row 1), for "show the bad row" UX. */
  sourceRow: number;
}

/** A row that was NOT imported, with a human-readable reason. */
export interface SkippedRow {
  sourceRow: number;
  reason: string;
  /** Raw cell values as they appeared, for display in the preview. */
  raw: Record<string, string>;
}

/** A pair of rows whose emails collide (case-insensitive). */
export interface DuplicateGroup {
  email: string;
  sourceRows: number[];
}

/** Which CSV header (verbatim) mapped to each logical field; null = not found. */
export interface ColumnMapping {
  name: string | null;
  email: string | null;
  period: string | null;
}

/** Full result of parsing a roster CSV. */
export interface ParseResult {
  students: ParsedStudent[];
  skipped: SkippedRow[];
  duplicates: DuplicateGroup[];
  columnMapping: ColumnMapping;
}

export const EMPTY_PARSE_RESULT: ParseResult = {
  students: [],
  skipped: [],
  duplicates: [],
  columnMapping: { name: null, email: null, period: null },
};
