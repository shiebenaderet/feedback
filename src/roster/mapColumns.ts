// src/roster/mapColumns.ts

// ColumnMapping shape (from src/roster/types.ts):
//   { name: string | null; email: string | null; period: string | null }
import type { ColumnMapping } from './types';

/** Synonyms per logical field. First header (in file order) matching any wins. */
const SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  name: ['name', 'full name', 'student name', 'student'],
  email: ['email', 'e-mail', 'email address', 'student email', 'student e-mail'],
  period: ['period', 'class', 'class period', 'section', 'block'],
};

/** Normalize a header for comparison: lowercase, collapse whitespace, trim. */
function norm(h: string): string {
  return h.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Map verbatim CSV headers to logical fields. Returns the original header string
 * (so callers can index PapaParse row objects), or null when no column matches.
 */
export function mapColumns(headers: string[]): ColumnMapping {
  const result: ColumnMapping = { name: null, email: null, period: null };
  for (const field of Object.keys(SYNONYMS) as (keyof ColumnMapping)[]) {
    const wanted = SYNONYMS[field];
    const found = headers.find((h) => wanted.includes(norm(h)));
    result[field] = found ?? null;
  }
  return result;
}
