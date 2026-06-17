// src/roster/rosterTemplate.ts

/** Logical header order for the downloadable roster template. */
export const ROSTER_TEMPLATE_HEADERS = ['name', 'email'] as const;

/** One example row so teachers see the expected shape (imports cleanly via parseRoster). */
const EXAMPLE_ROW = ['Ada Lovelace', 'ada.lovelace@school.edu'] as const;

/**
 * Build the `name,email` CSV template a teacher downloads, fills, and re-uploads.
 * Pure (no I/O). Headers match what mapColumns/parseRoster recognize, and the single
 * example row round-trips through parseRoster with no skips. Trailing newline so the
 * teacher's first added row lands on a fresh line.
 */
export function buildRosterTemplateCsv(): string {
  const header = ROSTER_TEMPLATE_HEADERS.join(',');
  const example = EXAMPLE_ROW.join(',');
  return `${header}\n${example}\n`;
}
