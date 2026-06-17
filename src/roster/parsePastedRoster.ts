// src/roster/parsePastedRoster.ts
import { parseRoster } from './parseRoster';
import { EMPTY_PARSE_RESULT, type ParseResult } from './types';

/**
 * Split one pasted line into [name, email]. Supports the common separators teachers
 * paste from spreadsheets/email: a comma, a tab, or a run of 2+ spaces between the
 * name and the email. Falls back to the last whitespace-delimited token as the email.
 */
function splitLine(line: string): [string, string] {
  const trimmed = line.trim();
  if (trimmed.includes(',')) {
    const idx = trimmed.indexOf(',');
    return [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
  }
  if (trimmed.includes('\t')) {
    const idx = trimmed.indexOf('\t');
    return [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
  }
  const multiSpace = trimmed.match(/^(.*?)\s{2,}(\S+)$/);
  if (multiSpace) return [multiSpace[1].trim(), multiSpace[2].trim()];
  // Last single-space-delimited token as email, the rest as name.
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return [trimmed, ''];
  return [trimmed.slice(0, lastSpace).trim(), trimmed.slice(lastSpace + 1).trim()];
}

/** Escape a value for inclusion in a CSV cell (quote if it contains a comma/quote). */
function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse free-form pasted roster text (one student per line, "Name, email" / tab / spaces)
 * into the same ParseResult shape parseRoster produces. Normalizes each line into a CSV row
 * under a known `name,email` header, then delegates ALL validation/dedup/skip reporting to
 * the existing parseRoster — no parallel validation logic. Blank input → an all-empty result.
 */
export function parsePastedRoster(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return EMPTY_PARSE_RESULT;

  const rows = lines.map((line) => {
    const [name, email] = splitLine(line);
    return `${csvCell(name)},${csvCell(email)}`;
  });

  const csv = `name,email\n${rows.join('\n')}\n`;
  return parseRoster(csv);
}
