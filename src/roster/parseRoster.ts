// src/roster/parseRoster.ts
import Papa from 'papaparse';
import { mapColumns } from './mapColumns';
import { normalizeName, normalizeEmail } from './normalize';
// ParseResult/ParsedStudent/SkippedRow/DuplicateGroup shapes live in src/roster/types.ts:
//   ParsedStudent  = { name; email; period; sourceRow }
//   SkippedRow     = { sourceRow; reason; raw: Record<string,string> }
//   DuplicateGroup = { email; sourceRows: number[] }
//   ParseResult    = { students; skipped; duplicates; columnMapping }
import type { ParseResult, ParsedStudent, SkippedRow, DuplicateGroup } from './types';
import { EMPTY_PARSE_RESULT } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a roster CSV string into students + a full audit of what was skipped.
 * Pure: no I/O. PapaParse runs with `header: true`; row objects are keyed by header.
 */
export function parseRoster(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const headers = parsed.meta.fields ?? [];
  const columnMapping = mapColumns(headers);

  // No email column at all → nothing is importable; report one explanatory skip.
  if (!columnMapping.email) {
    return {
      ...EMPTY_PARSE_RESULT,
      columnMapping,
      skipped: [{ sourceRow: 1, reason: 'No email column found in file', raw: {} }],
    };
  }

  const students: ParsedStudent[] = [];
  const skipped: SkippedRow[] = [];
  const dupRowsByEmail = new Map<string, number[]>();
  const seenEmails = new Set<string>();

  parsed.data.forEach((row, i) => {
    const sourceRow = i + 2; // header is row 1; first data row is row 2.
    const rawName = columnMapping.name ? (row[columnMapping.name] ?? '') : '';
    const rawEmail = row[columnMapping.email!] ?? '';
    const rawPeriod = columnMapping.period ? (row[columnMapping.period] ?? '') : '';

    const name = normalizeName(rawName);
    const email = normalizeEmail(rawEmail);

    if (!email) {
      skipped.push({ sourceRow, reason: 'Missing email', raw: row });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      skipped.push({ sourceRow, reason: 'Invalid email format', raw: row });
      return;
    }
    if (!name) {
      skipped.push({ sourceRow, reason: 'Missing name', raw: row });
      return;
    }

    if (seenEmails.has(email)) {
      const rows = dupRowsByEmail.get(email);
      if (rows) rows.push(sourceRow);
      skipped.push({ sourceRow, reason: 'Duplicate email', raw: row });
      return;
    }

    seenEmails.add(email);
    dupRowsByEmail.set(email, [sourceRow]);
    students.push({ name, email, period: rawPeriod.trim(), sourceRow });
  });

  const duplicates: DuplicateGroup[] = [];
  for (const [email, sourceRows] of dupRowsByEmail) {
    if (sourceRows.length > 1) duplicates.push({ email, sourceRows });
  }

  return { students, skipped, duplicates, columnMapping };
}
